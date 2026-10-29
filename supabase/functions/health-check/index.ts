import { createClient } from 'jsr:@supabase/supabase-js@2';
import { runChecks, buildPushMessage, buildEmail } from './checks.js';

// 건강검진 — pg_cron 이 매일 00:00 UTC(= JST 09:00) 에 호출한다 (job: health-check-daily)
//   숫자 = DB 함수 health_snapshot() / 판정·문구 = ./checks.js (Jest 로 검증)
//   결과는 health_check_runs 에 저장하고 개발자에게 알린다:
//     🔴 있으면 개발자 폰 푸시(OPS_USER_ID) · 매일 요약 메일(OPS_EMAIL, Resend) · 끝나면 하트비트(HEARTBEAT_URL, 선택)
//   호출 확인: pg_cron 은 공개 열쇠(anon)로 부르므로 역할만으론 구별이 안 된다 →
//     ① x-health-secret 헤더가 Vault 암호와 같거나(health_check_secret_ok) ② service_role(CLI 수동 실행)일 때만 받는다
//     학생·외부인이 불러서 개발자에게 알림을 폭탄으로 보내지 못하게.
//   ?notify=0 이면 저장·알림 없이 결과만 돌려준다 (시험용)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// verify_jwt 가 서명은 이미 검증했다 → 역할(role)만 읽는다
function roleOf(req: Request): string | null {
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const payload = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload))?.role ?? null;
  } catch {
    return null;
  }
}

async function sendOpsPush(supabase: any, userId: string, msg: { title: string; body: string }) {
  const { data: tokens } = await supabase.from('push_tokens').select('expo_token').eq('user_id', userId);
  if (!tokens?.length) return 0;
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tokens.map((t: { expo_token: string }) => ({ to: t.expo_token, sound: 'default', ...msg }))),
  });
  if (!res.ok) console.error('[health-check] 푸시 HTTP 실패:', res.status);
  return res.ok ? tokens.length : 0;
}

async function sendOpsEmail(to: string, mail: { subject: string; text: string }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'UniOne 건강검진 <noreply@unipas.app>', to: [to], ...mail }),
  });
  if (!res.ok) console.error('[health-check] 메일 실패:', res.status, await res.text());
  return res.ok;
}

async function check(req: Request) {
  const notify = new URL(req.url).searchParams.get('notify') !== '0';
  const now = new Date();
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let results, worst;
  const { data: snap, error } = await supabase.rpc('health_snapshot');
  if (error) {
    results = [{ id: 'snapshot', title: '건강검진 숫자 읽기', level: 'critical', message: `health_snapshot() 실패: ${error.message}` }];
    worst = 'critical';
  } else {
    ({ results, worst } = runChecks(snap, { now }));
  }
  if (!notify) return json({ worst, results });

  await supabase.from('health_check_runs').insert({ worst_level: worst, results });

  const sent = { push: 0, email: false, heartbeat: false };
  const opsUserId = Deno.env.get('OPS_USER_ID');
  const opsEmail = Deno.env.get('OPS_EMAIL');
  const heartbeatUrl = Deno.env.get('HEARTBEAT_URL');

  const pushMsg = buildPushMessage(results);
  if (pushMsg && opsUserId) sent.push = await sendOpsPush(supabase, opsUserId, pushMsg);
  if (opsEmail) sent.email = await sendOpsEmail(opsEmail, buildEmail(results, now));
  // 하트비트: 끝까지 왔다는 신호. 이 신호가 끊기면 외부 감시(UptimeRobot)가 알려준다
  if (heartbeatUrl) sent.heartbeat = (await fetch(heartbeatUrl).catch(() => null))?.ok ?? false;

  console.log('[health-check]', worst, JSON.stringify(sent));
  return json({ worst, sent, counts: results.map((r: { id: string; level: string }) => `${r.id}:${r.level}`) });
}

async function isAllowed(req: Request) {
  if (roleOf(req) === 'service_role') return true;
  const secret = req.headers.get('x-health-secret');
  if (!secret) return false;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data } = await admin.rpc('health_check_secret_ok', { p_secret: secret });
  return data === true;
}

Deno.serve(async (req: Request) => {
  if (!(await isAllowed(req))) return json({ error: 'forbidden' }, 403);
  try {
    return await check(req);
  } catch (e) {
    // 건강검진 자체가 죽은 경우 — 메일이라도 한 통 보낸다 (하트비트는 안 보내므로 외부 감시도 울린다)
    const msg = (e as Error)?.message ?? String(e);
    console.error('[health-check] 예외:', msg);
    const opsEmail = Deno.env.get('OPS_EMAIL');
    if (opsEmail) await sendOpsEmail(opsEmail, { subject: '[UniOne 건강검진] 🔴 건강검진 자체 오류', text: msg }).catch(() => {});
    return json({ error: msg }, 500);
  }
});
