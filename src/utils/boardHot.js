// 게시판 첫 화면 「リアルタイム人気」 고르기 (2026-10-21 목업 승인)
//   최근 7일 글 중 좋아요+댓글 합계가 높은 순으로 최대 2개. 반응 0 글은 제외 → 없으면 칸을 숨긴다.
//   글이 적은 지금(글 23·최고 좋아요 4)은 「10개 이상」 같은 절대 기준이면 늘 비어서 상대 순위로 고른다.
//   2026-10-21 실데이터 검증: 7일 안에 반응 있는 글이 1개뿐이고 하루 뒤 0개 → 칸이 사라짐.
//   그래서 7일에 없으면 30일까지 넓혀 본다(표시도 「直近30日」).
export const HOT_DAYS = 7;
export const HOT_FALLBACK_DAYS = 30;
export const HOT_LIMIT = 2;

export function hotScore(post) {
  const comments = post?.post_comments?.[0]?.count ?? 0;
  return (post?.like_count ?? 0) + comments;
}

export function pickHotPosts(posts, { now = Date.now(), days = HOT_DAYS, limit = HOT_LIMIT } = {}) {
  const since = now - days * 24 * 60 * 60 * 1000;
  return (posts ?? [])
    .filter((p) => new Date(p.created_at).getTime() >= since && hotScore(p) > 0)
    .sort((a, b) => hotScore(b) - hotScore(a) || new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
}

// 7일 → (없으면) 30일 순서로 고른다. 반환 { posts, days } — days 는 화면의 「直近◯日」 표시용
export function pickHotWithFallback(posts, { now = Date.now(), limit = HOT_LIMIT } = {}) {
  for (const days of [HOT_DAYS, HOT_FALLBACK_DAYS]) {
    const picked = pickHotPosts(posts, { now, days, limit });
    if (picked.length > 0) return { posts: picked, days };
  }
  return { posts: [], days: HOT_DAYS };
}

// 인기 카드의 시각 표기 「10/20 22:14」 (기기 시간대 = 일본 사용자 기준 JST)
export function formatHotTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
