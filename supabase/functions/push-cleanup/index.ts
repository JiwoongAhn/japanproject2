import { createClient } from 'jsr:@supabase/supabase-js@2';

// 정리 워커 — 매일 03:00 JST cron 실행
// - delivered: 30일 경과 행 삭제 (가시성 가치 없음)
// - dead / permanent_fail: 90일 경과 행 삭제 (장기 보관 가치 없음)
//
// 마이페이지 배지(최근 7일 실패 카운트)는 30/90일 윈도우 내에서 충분히 표현된다.

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const day = 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = new Date(Date.now() - 30 * day).toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * day).toISOString();

  const { count: deliveredDeleted, error: e1 } = await supabase
    .from('push_delivery_logs')
    .delete({ count: 'exact' })
    .eq('status', 'delivered')
    .lte('created_at', thirtyDaysAgo);

  if (e1) console.error('[cleanup] delivered 삭제 실패:', e1.message);

  const { count: failedDeleted, error: e2 } = await supabase
    .from('push_delivery_logs')
    .delete({ count: 'exact' })
    .in('status', ['dead', 'permanent_fail'])
    .lte('created_at', ninetyDaysAgo);

  if (e2) console.error('[cleanup] dead/permanent_fail 삭제 실패:', e2.message);

  return new Response(
    JSON.stringify({
      delivered_deleted: deliveredDeleted ?? 0,
      failed_deleted: failedDeleted ?? 0,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
