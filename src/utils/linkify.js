/**
 * 게시판 본문·댓글에서 URL 을 찾아 「일반 텍스트 / 링크」 조각으로 쪼갠다.
 *
 * 왜 직접 만드는가: React Native 의 Text 는 URL 을 자동으로 링크로 만들어주지 않는다.
 * 유저가 올린 수강 신청 페이지·설문 링크를 복사해서 브라우저에 붙여넣어야 했다.
 *
 * ⚠️ 일본어 문장은 URL 뒤에 전각 문장부호가 바로 붙는다
 *    예) 「詳しくは https://example.com/a をご覧ください。」
 *    전각 문자를 URL 에 포함시키면 링크가 깨지므로 URL 문자에서 제외한다.
 */

// URL 로 인정하는 문자: 공백·전각 문장부호·꺾쇠 제외
const URL_BODY = '[^\\s、。，．！？「」『』（）【】〈〉《》〔〕・…～＜＞"\'`]+';
const URL_PATTERN = new RegExp(`(https?://${URL_BODY}|www\\.${URL_BODY})`, 'gi');

// URL 끝에 딸려온 반각 문장부호는 URL 이 아니라 문장의 일부다
// 예) 'https://example.com/a).' → 'https://example.com/a'
const TRAILING_PUNCT = /[.,!?;:)\]}>'"]+$/;

/**
 * 괄호가 짝이 맞으면 닫는 괄호를 URL 의 일부로 남긴다.
 * 위키백과 주소처럼 괄호가 들어간 URL 이 깨지는 것을 막는다.
 * 예) 'https://ja.wikipedia.org/wiki/Foo_(bar)' 는 그대로 둔다
 */
function trimTrailingPunctuation(url) {
  let result = url;
  let guard = 0;

  while (guard < 10) {
    guard += 1;
    const match = result.match(TRAILING_PUNCT);
    if (!match) break;

    const trimmed = result.slice(0, result.length - match[0].length);

    // 잘라낸 것이 ')' 하나뿐이고 URL 안에 여는 '(' 가 더 많다면 되돌린다
    if (match[0] === ')') {
      const opens = (trimmed.match(/\(/g) || []).length;
      const closes = (trimmed.match(/\)/g) || []).length;
      if (opens > closes) break;
    }

    result = trimmed;
    if (!result) break;
  }

  return result;
}

/** www. 로 시작하는 주소는 스킴을 붙여줘야 브라우저가 연다 */
export function normalizeUrl(url) {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/**
 * @returns {{type: 'text'|'link', value: string, url?: string}[]}
 *   value = 화면에 보여줄 문자열 / url = 실제로 열 주소
 */
export function splitTextWithLinks(text) {
  if (!text) return [];

  const parts = [];
  let lastIndex = 0;

  // exec 반복을 위해 매번 새 정규식을 쓴다 (lastIndex 공유 사고 방지)
  const re = new RegExp(URL_PATTERN.source, 'gi');
  let match = re.exec(text);

  while (match) {
    const raw = match[0];
    const url = trimTrailingPunctuation(raw);

    // 문장부호만 남은 경우(= URL 이 아니었음)는 그냥 텍스트로 둔다
    if (!url || url === 'www.' || /^https?:\/\/$/i.test(url)) {
      match = re.exec(text);
      continue;
    }

    const start = match.index;
    if (start > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, start) });
    }

    parts.push({ type: 'link', value: url, url: normalizeUrl(url) });
    lastIndex = start + url.length;

    // 잘라낸 문장부호는 다음 텍스트 조각에서 다시 다뤄진다
    re.lastIndex = lastIndex;
    match = re.exec(text);
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts;
}

/** 링크가 하나도 없으면 컴포넌트가 조각내기를 건너뛸 수 있다 */
export function hasLink(text) {
  if (!text) return false;
  return splitTextWithLinks(text).some((p) => p.type === 'link');
}
