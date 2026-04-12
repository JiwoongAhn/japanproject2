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

export const BOARD_CATEGORIES = [
  { key: 'qa',     label: '質問',    color: colors.primary  },
  { key: 'free',   label: 'フリー',  color: colors.success  },
  { key: 'flea',   label: 'フリマ',  color: colors.warning  },
  // ↓ 새 게시판 추가 예시 (주석 해제 후 사용)
  // { key: 'event',  label: 'イベント', color: '#A855F7'       },
  // { key: 'club',   label: 'サークル', color: '#F43F5E'       },
];

// key → 카테고리 정보 찾기 헬퍼
export function getCategoryInfo(key) {
  return BOARD_CATEGORIES.find(c => c.key === key) || BOARD_CATEGORIES[0];
}
