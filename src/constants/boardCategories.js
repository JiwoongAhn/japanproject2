// ──────────────────────────────────────────────────────────────
// 게시판 카테고리 정의
//
// 새 게시판을 추가하려면:
//   1. 아래 배열에 항목 추가
//   2. schema.sql의 posts 테이블 category CHECK 조건에 key 추가
//      예: CHECK (category IN ('qa', 'free', 'flea', '새key'))
//   3. Supabase SQL Editor에서 ALTER TABLE 실행
// ──────────────────────────────────────────────────────────────

import { colors } from './colors';

// ──────────────────────────────────────────────────────────────
// 게시판 카테고리 정의
//
// 새 게시판을 추가하려면:
//   1. 아래 배열에 항목 추가
//   2. Supabase SQL Editor에서 아래 마이그레이션 실행:
//      ALTER TABLE posts DROP CONSTRAINT posts_category_check;
//      ALTER TABLE posts ADD CONSTRAINT posts_category_check
//        CHECK (category IN ('qa', 'free', 'secret', 'info', '새key'));
// ──────────────────────────────────────────────────────────────

export const BOARD_CATEGORIES = [
  { key: 'qa',     label: '質問',  color: colors.primary  },
  { key: 'free',   label: '自由',  color: colors.success  },
  { key: 'secret', label: '秘密',  color: '#A855F7'       },
  { key: 'info',   label: '情報',  color: colors.warning  },
];

// key → 카테고리 정보 찾기 헬퍼 (없으면 첫 번째 카테고리 반환)
export function getCategoryInfo(key) {
  return BOARD_CATEGORIES.find(c => c.key === key) || BOARD_CATEGORIES[0];
}
