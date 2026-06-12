// 금칙어(욕설·차별 표현) 작성 차단용 — 클라이언트 1차 필터.
// App Store UGC 1.2 "불쾌 콘텐츠 필터" 요건. 완벽 차단이 아니라 필터 메커니즘 제공이 목적.
// 순수 함수만 둔다 (테스트: __tests__/utils/profanity.test.js).

// 일본어 비속어·차별 표현 + 영어/한국어 일부. 운영하며 보강.
const BANNED_WORDS = [
  // 일본어 — 폭력/위협
  '死ね', 'しね', '殺す', 'ころす', 'ぶっ殺', '殺るぞ',
  // 일본어 — 차별/모욕
  'きちがい', 'キチガイ', 'ガイジ', '池沼', '障害者か',
  'ブス', 'デブ', 'きもい', 'キモい', 'きしょい', 'うざい', 'ウザい',
  'バカ', 'ばか', 'アホ', 'あほ', 'クズ', 'くず', 'カス', 'ゴミ', 'クソ', 'くそ',
  // 일본어 — 성적
  'まんこ', 'ちんこ', 'ちんちん', 'セックス',
  // 영어
  'fuck', 'shit', 'bitch', 'asshole', 'bastard',
  // 한국어 (혼용 작성 대비)
  '병신', '시발', '씨발', '개새', '존나',
];

// 우회 방지: 공백·전각공백·일부 구분기호 제거 + 소문자화
function normalize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[\s　.,_\-*~・･]/g, '');
}

const NORMALIZED_BANNED = BANNED_WORDS.map(normalize);

/**
 * 텍스트에서 처음 발견된 금칙어를 반환. 없으면 null.
 * @param {string} text
 * @returns {string|null}
 */
export function findProfanity(text) {
  const norm = normalize(text);
  if (!norm) return null;
  for (let i = 0; i < NORMALIZED_BANNED.length; i++) {
    if (norm.includes(NORMALIZED_BANNED[i])) return BANNED_WORDS[i];
  }
  return null;
}

/**
 * 여러 텍스트(제목+본문 등)를 한 번에 검사. 처음 발견된 금칙어 반환, 없으면 null.
 * @param  {...string} texts
 * @returns {string|null}
 */
export function findProfanityInAny(...texts) {
  for (const t of texts) {
    const hit = findProfanity(t);
    if (hit) return hit;
  }
  return null;
}

export function containsProfanity(text) {
  return findProfanity(text) !== null;
}
