import { createClient } from 'jsr:@supabase/supabase-js@2';
import { runDeadlineReminders } from '../_shared/deadlineReminder.js';

// 締切 3日前·前日 알림 — pg_cron 이 매일 09:00 UTC(= JST 18:00) 에 호출한다 (job: deadline-reminder-daily)
//   규칙·문구는 _shared/deadlineReminder.js (Jest 로 검증)
//   응답에는 건수만 담는다 — 누가 호출해도 과제 내용이 새지 않게.
//   같은 課題는 3日前·前日 각각 한 번만 알리므로(reminded_3d_at·reminded_at) 여러 번 호출돼도 중복 발송은 없다.

Deno.serve(async (_req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const result = await runDeadlineReminders(supabase, {
      now: new Date(),
      send: async (messages: unknown[]) => {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messages),
        });
        if (!res.ok) {
          console.error('[deadline-reminder] Expo HTTP 실패:', res.status);
          return [];
        }
        const j = await res.json();
        return Array.isArray(j?.data) ? j.data : [];
      },
    });
    console.log('[deadline-reminder]', JSON.stringify(result));
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[deadline-reminder] 예외:', (e as Error)?.message ?? e);
    return new Response('error', { status: 500 });
  }
});
