import { createClient } from 'jsr:@supabase/supabase-js@2';

// Microsoft Graph subscription 최대 만료: 3일
// 이 함수는 매일 1회 pg_cron으로 실행 — 만료 24시간 이내 subscription을 갱신
const RENEW_BEFORE_HOURS = 24;
const NEW_EXPIRY_DAYS    = 3;
const MS_TENANT_ID       = 'common';

// ── 메일 refresh_token 암호화 (AES-256-GCM, 키=Supabase secret MAIL_TOKEN_ENC_KEY) ──
// 키는 DB가 아니라 함수 시크릿에만 보관 → DB가 통째로 유출돼도 토큰은 해독 불가.
const ENC_PREFIX = 'enc:v1:';
async function getEncKey(): Promise<CryptoKey> {
  const bytes = Uint8Array.from(atob(Deno.env.get('MAIL_TOKEN_ENC_KEY') ?? ''), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
async function encryptToken(plain: string | null | undefined): Promise<string | null> {
  if (!plain) return plain ?? null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await getEncKey(), new TextEncoder().encode(plain)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv); out.set(ct, iv.length);
  return ENC_PREFIX + btoa(String.fromCharCode(...out));
}
async function decryptToken(stored: string | null | undefined): Promise<string> {
  if (!stored) return '';
  if (!stored.startsWith(ENC_PREFIX)) return stored; // 레거시 평문 호환
  const raw = Uint8Array.from(atob(stored.slice(ENC_PREFIX.length)), (c) => c.charCodeAt(0));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, await getEncKey(), raw.slice(12));
  return new TextDecoder().decode(pt);
}

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 만료까지 24시간 이내인 subscription 전체 조회
  const threshold = new Date(Date.now() + RENEW_BEFORE_HOURS * 60 * 60 * 1000).toISOString();
  const { data: subs, error } = await supabase
    .from('mail_subscriptions')
    .select('user_id, subscription_id, ms_refresh_token')
    .lte('subscription_expires_at', threshold)
    .not('subscription_id', 'is', null);

  if (error) {
    console.error('[ms-graph-renew] 조회 실패:', error.message);
    return new Response('error', { status: 500 });
  }

  console.log(`[ms-graph-renew] 갱신 대상: ${subs?.length ?? 0}건`);
  let renewed = 0;

  for (const sub of subs ?? []) {
    // ① refresh_token으로 새 access_token 발급
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     Deno.env.get('MS_CLIENT_ID') ?? '',
          client_secret: Deno.env.get('MS_CLIENT_SECRET') ?? '',
          grant_type:    'refresh_token',
          refresh_token: await decryptToken(sub.ms_refresh_token), // 복호화해서 사용
          scope:         'Mail.Read offline_access',
        }),
      }
    );

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error(`[ms-graph-renew] 토큰 갱신 실패 user=${sub.user_id}:`, errBody);
      // invalid_grant = refresh_token이 만료/무효화됨 → 사용자가 직접 재연결해야 함
      // (5xx 같은 일시 오류는 다음 실행에서 자동 재시도되므로 배지 띄우지 않음)
      if (errBody.includes('invalid_grant')) {
        await supabase
          .from('mail_subscriptions')
          .update({ needs_reauth: true })
          .eq('user_id', sub.user_id);
        console.log(`[ms-graph-renew] 재연결 필요 표시 user=${sub.user_id}`);
      }
      continue;
    }

    const tokens = await tokenRes.json();
    const accessToken = tokens.access_token;

    // ② Graph subscription 만료일 연장
    const newExpiry = new Date(Date.now() + NEW_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const patchRes  = await fetch(
      `https://graph.microsoft.com/v1.0/subscriptions/${sub.subscription_id}`,
      {
        method:  'PATCH',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expirationDateTime: newExpiry }),
      }
    );

    if (!patchRes.ok) {
      console.error(`[ms-graph-renew] subscription 갱신 실패 id=${sub.subscription_id}:`, await patchRes.text());
      continue;
    }

    // ③ DB 업데이트
    await supabase
      .from('mail_subscriptions')
      .update({
        subscription_expires_at: newExpiry,
        // 새 토큰이 오면 암호화해 저장, 없으면 기존 암호문 유지
        ms_refresh_token:        tokens.refresh_token ? await encryptToken(tokens.refresh_token) : sub.ms_refresh_token,
      })
      .eq('user_id', sub.user_id);

    renewed++;
    console.log(`[ms-graph-renew] 갱신 완료 user=${sub.user_id}`);
  }

  return new Response(
    JSON.stringify({ renewed, total: subs?.length ?? 0 }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
