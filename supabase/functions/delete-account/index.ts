import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const IMAGE_BUCKET = 'post-images';

// 사용자 폴더의 사진을 전부 지우고 지운 개수를 돌려준다.
// list 는 한 번에 최대 100개라, 빈 결과가 나올 때까지 반복한다(지운 만큼 목록이 줄어든다).
// deno-lint-ignore no-explicit-any
async function removeUserImages(admin: any, userId: string): Promise<number> {
  let total = 0;
  for (let round = 0; round < 50; round++) {
    const { data, error } = await admin.storage.from(IMAGE_BUCKET).list(userId, { limit: 100 });
    if (error) throw new Error(error.message);
    const paths = (data ?? [])
      .filter((f: { id: string | null }) => f.id) // id 없는 항목 = 하위 폴더 표시용
      .map((f: { name: string }) => `${userId}/${f.name}`);
    if (paths.length === 0) break;
    const { error: removeError } = await admin.storage.from(IMAGE_BUCKET).remove(paths);
    if (removeError) throw new Error(removeError.message);
    total += paths.length;
  }
  return total;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 요청한 사람의 JWT 토큰으로 본인 확인
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '認証情報がありません' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // anon 클라이언트로 JWT 검증 → 요청자 ID 확인
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'ユーザーが見つかりません' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // service_role 클라이언트로 계정 삭제 (관리자 권한)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    // 게시판 사진(post-images/{userId}/…) 삭제 — DB 행은 계정 삭제로 함께 지워지지만 Storage 파일은 남는다.
    // 공개 버킷이라 남기면 탈퇴 후에도 주소로 열린다(개인정보). 계정 삭제가 끝난 뒤에 지운다:
    // 먼저 지웠다가 계정 삭제가 실패하면 계정은 남고 글의 사진만 깨지기 때문.
    // 실패해도 탈퇴 자체는 성공으로 돌려주고 로그만 남긴다(남은 파일은 수동 정리 대상).
    try {
      const removed = await removeUserImages(supabaseAdmin, user.id);
      console.log(`delete-account: removed ${removed} images for ${user.id}`);
    } catch (e) {
      console.error(`delete-account: image cleanup failed for ${user.id}: ${(e as Error).message}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
