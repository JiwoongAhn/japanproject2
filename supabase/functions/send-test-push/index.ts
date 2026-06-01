import { createClient } from 'jsr:@supabase/supabase-js@2';

// 개발용 — 특정 user_id에게 테스트 푸시 발송 + push_delivery_logs 적재.
// 시나리오 1(정상) / 4(잘못된 토큰 = DeviceNotRegistered)를 자동 검증한다.
//
// 사용법:
//   supabase functions invoke send-test-push --body '{"userId":"xxx"}'
//   supabase functions invoke send-test-push --body '{"userId":"xxx","scenario":"normal"}'
//   supabase functions invoke send-test-push --body '{"userId":"xxx","scenario":"invalid_token"}'
//   supabase functions invoke send-test-push --body '{"userId":"xxx","scenario":"mixed"}'

const PERMANENT_ERRORS = ['DeviceNotRegistered', 'MessageTooBig', 'MismatchSenderId', 'InvalidCredentials'];
const FAKE_INVALID_TOKEN = 'ExponentPushToken[XXXXXXXXXXXXXXXXXXXXXX]';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, scenario = 'normal' } = await req.json();
    if (!userId) {
      return json({ error: 'userId가 필요합니다' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 실제 토큰 조회 (normal / mixed 시나리오에서 사용)
    const { data: tokenRows } = await supabase
      .from('push_tokens')
      .select('expo_token')
      .eq('user_id', userId);

    const realTokens = (tokenRows ?? []).map(t => t.expo_token);

    // 시나리오별 발송 대상 토큰 결정
    let targets: string[] = [];
    if (scenario === 'normal') {
      if (!realTokens.length) return json({ error: '푸시 토큰 없음' }, 404);
      targets = realTokens;
    } else if (scenario === 'invalid_token') {
      targets = [FAKE_INVALID_TOKEN];
    } else if (scenario === 'mixed') {
      if (!realTokens.length) return json({ error: '실제 토큰 없음 (mixed 시나리오용)' }, 404);
      targets = [...realTokens, FAKE_INVALID_TOKEN];
    } else {
      return json({ error: `알 수 없는 시나리오: ${scenario}` }, 400);
    }

    const payload = {
      subject:   `[테스트:${scenario}] 情報処理演習 授業資料更新`,
      bodyHtml:  '<p>テスト本文です。manaba からの通知をシミュレートしています。</p>',
      noticeUrl: 'https://kokushikan.manaba.jp/ct/course_notice',
    };

    const messages = targets.map(to => ({
      to,
      title: '📢 [테스트] manaba 新着通知',
      body:  payload.subject,
      data:  payload,
      sound: 'default',
    }));

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(messages),
    });

    const result = await res.json();
    const tickets: any[] = Array.isArray(result?.data) ? result.data : [];
    console.log('[send-test-push] Expo result:', JSON.stringify(result));

    // push_delivery_logs 적재 (notice_id는 null = 테스트용 가짜)
    const rows = targets.map((expoToken, i) => {
      const t = tickets[i];
      if (t?.status === 'ok') {
        return {
          user_id: userId,
          notice_id: null,
          expo_token: expoToken,
          ticket_id: t.id,
          status: 'pending',
          attempts: 1,
          payload,
        };
      }
      const code = t?.details?.error ?? 'UNKNOWN';
      const msg  = t?.message ?? '';
      if (PERMANENT_ERRORS.includes(code)) {
        if (code === 'DeviceNotRegistered') {
          // 실제 push_tokens은 건드리지 않음 (테스트 가짜 토큰은 어차피 DB에 없음)
        }
        return {
          user_id: userId,
          notice_id: null,
          expo_token: expoToken,
          ticket_id: null,
          status: 'permanent_fail',
          attempts: 1,
          last_error_code: code,
          last_error_msg: msg,
          payload,
        };
      }
      return {
        user_id: userId,
        notice_id: null,
        expo_token: expoToken,
        ticket_id: null,
        status: 'retry_pending',
        attempts: 1,
        last_error_code: code,
        last_error_msg: msg,
        next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        payload,
      };
    });

    const { error: logErr } = await supabase.from('push_delivery_logs').insert(rows);
    if (logErr) console.error('[send-test-push] log insert 실패:', logErr.message);

    // 시나리오별 검증 결과 요약
    const summary = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});

    return json({ success: true, scenario, sent: targets.length, summary, tickets });

  } catch (e) {
    console.error('[send-test-push] 예외:', e);
    return json({ error: '서버 오류' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
