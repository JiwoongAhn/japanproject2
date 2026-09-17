/**
 * overflowProbe.js — 레이아웃 "넘침" 자동 판정 (정답 이미지 없이 불변식으로 판정)
 *
 * 픽셀 비교(baseline)는 첫 실행에 정답이 없고, "깨진 상태를 정답으로 굳히는" 함정이 있다.
 * 대신 페이지 안에서 getBoundingClientRect()로 아래 불변식을 검사한다. 위반이 0건이면 통과.
 *
 *  ① clip-escape   : overflow:hidden 조상 밖으로 세로로 빠져나간 텍스트
 *  ② hidden-scroll : overflow-y:hidden 인데 scrollHeight > clientHeight (잘려서 안 보이는 내용)
 *  ③ viewport      : 스크롤 가능한 조상 없이 뷰포트 위/아래로 나간 텍스트
 *  ④ cta           : 주요 버튼(次へ 등)이 뷰포트 안에 완전히 들어와 있는가
 *  ⑤ overlap       : 형제(조상 관계가 아닌) 블록끼리 세로 겹침이 4px 초과
 *
 * ⚠️ X축은 검사하지 않는다 — 가로 페이저(슬라이드) 때문에 오탐의 대부분이 거기서 난다.
 *    화면 밖(가로) 슬라이드의 요소는 아예 검사 대상에서 뺀다.
 */

const OVERLAP_TOLERANCE = 4;

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ ctaTexts?: string[], overlapTolerance?: number }} [opts]
 * @returns {Promise<Array<{type:string, detail:string}>>} 위반 목록 (빈 배열 = 통과)
 */
async function probeOverflow(page, opts = {}) {
  const { ctaTexts = [], overlapTolerance = OVERLAP_TOLERANCE } = opts;

  return page.evaluate(({ ctaTexts, tol }) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const violations = [];
    const push = (type, detail) => violations.push({ type, detail });
    const snip = (el) => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    const r = (el) => el.getBoundingClientRect();

    // 보이는 요소만 (display:none·visibility:hidden·opacity:0·크기 0 제외)
    const isVisible = (el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      const b = r(el);
      return b.width > 0 && b.height > 0;
    };
    // 가로로 뷰포트 안에 (일부라도) 들어온 요소만 — 옆 슬라이드는 제외 (경계 반올림 여유 2px)
    const inViewportX = (b) => b.right > 2 && b.left < vw - 2;

    // "직접 텍스트를 가진" 요소 = 자식 텍스트노드에 비공백 문자가 있는 요소
    const hasOwnText = (el) =>
      Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);

    const all = Array.from(document.body.querySelectorAll('*'));
    const textEls = all.filter((el) => hasOwnText(el) && isVisible(el) && inViewportX(r(el)));

    const overflowClips = (cs) => ['hidden', 'clip'].includes(cs.overflowY);
    const overflowScrolls = (cs) => ['auto', 'scroll'].includes(cs.overflowY);

    // ① clip-escape / ③ viewport
    //    세로 스크롤 가능한 조상(overflow-y:auto/scroll + 실제 넘침)이 클리핑 조상보다 안쪽에 있으면
    //    그 내용은 스크롤로 볼 수 있으므로 결함으로 세지 않는다.
    for (const el of textEls) {
      const b = r(el);
      let p = el.parentElement;
      let clippedBy = null;
      let scrollable = false;
      while (p && p !== document.body) {
        const cs = getComputedStyle(p);
        if (overflowScrolls(cs) && p.scrollHeight > p.clientHeight + 1) scrollable = true;
        if (!clippedBy && !scrollable && overflowClips(cs)) clippedBy = p;
        p = p.parentElement;
      }
      if (clippedBy) {
        const c = r(clippedBy);
        if (b.bottom > c.bottom + 1 || b.top < c.top - 1) {
          push('clip-escape', `"${snip(el)}" y=${Math.round(b.top)}~${Math.round(b.bottom)} 가 클리핑 조상 y=${Math.round(c.top)}~${Math.round(c.bottom)} 밖`);
        }
      }
      if (!scrollable && (b.bottom > vh + 1 || b.top < -1)) {
        push('viewport', `"${snip(el)}" y=${Math.round(b.top)}~${Math.round(b.bottom)} 가 뷰포트(0~${vh}) 밖 (스크롤 불가)`);
      }
    }

    // ② hidden-scroll
    for (const el of all) {
      if (!isVisible(el)) continue;
      const b = r(el);
      if (!inViewportX(b)) continue;
      const cs = getComputedStyle(el);
      if (overflowClips(cs) && el.scrollHeight > el.clientHeight + 1) {
        push('hidden-scroll', `overflow-y:hidden 요소("${snip(el)}") scrollHeight=${el.scrollHeight} > clientHeight=${el.clientHeight}`);
      }
    }

    // ④ cta
    for (const text of ctaTexts) {
      const cands = textEls.filter((el) => (el.textContent || '').trim() === text);
      if (cands.length === 0) { push('cta', `"${text}" 버튼을 찾지 못함`); continue; }
      const ok = cands.some((el) => { const b = r(el); return b.top >= 0 && b.bottom <= vh; });
      if (!ok) {
        const b = r(cands[0]);
        push('cta', `"${text}" y=${Math.round(b.top)}~${Math.round(b.bottom)} 가 뷰포트(0~${vh}) 밖`);
      }
    }

    // 실제로 보이는 영역 = 요소 rect ∩ 모든 클리핑/스크롤 조상의 rect (가려진 부분은 겹침 판정에서 제외)
    const visibleRect = (el) => {
      let { top, bottom, left, right } = r(el);
      let p = el.parentElement;
      while (p && p !== document.body) {
        const cs = getComputedStyle(p);
        if (overflowClips(cs) || overflowScrolls(cs)) {
          const c = r(p);
          top = Math.max(top, c.top); bottom = Math.min(bottom, c.bottom);
          left = Math.max(left, c.left); right = Math.min(right, c.right);
        }
        p = p.parentElement;
      }
      return { top, bottom, left, right };
    };

    // ⑤ overlap — 텍스트 블록 + "상자"(배경/테두리 있는 요소)끼리 "보이는 영역" 기준 세로 겹침
    const isBox = (el) => {
      const cs = getComputedStyle(el);
      return cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(cs.borderTopWidth) > 0;
    };
    const blocks = all.filter((el) => isVisible(el) && inViewportX(r(el)) && (hasOwnText(el) || isBox(el)));
    // 텍스트 블록은 "부모가 텍스트 요소가 아닌 최상위 텍스트"만 (중첩 Text 오탐 방지)
    const topText = textEls.filter((el) => !el.parentElement || !hasOwnText(el.parentElement));
    const seen = new Set();
    for (const a of topText) {
      const ra = visibleRect(a);
      if (ra.bottom - ra.top <= 0) continue; // 완전히 가려진 요소는 제외
      for (const b of blocks) {
        if (a === b || a.contains(b) || b.contains(a)) continue;
        const ia = all.indexOf(a), ib = all.indexOf(b);
        const key = `${Math.min(ia, ib)}-${Math.max(ia, ib)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const rb = visibleRect(b);
        if (rb.bottom - rb.top <= 0) continue;
        const xOverlap = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const yOverlap = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (xOverlap > 0 && yOverlap > tol) {
          push('overlap', `"${snip(a)}"(y=${Math.round(ra.top)}~${Math.round(ra.bottom)}) 와 "${snip(b) || b.tagName}"(y=${Math.round(rb.top)}~${Math.round(rb.bottom)}) 세로 ${Math.round(yOverlap)}px 겹침`);
        }
      }
    }

    return violations;
  }, { ctaTexts, tol: overlapTolerance });
}

/** 위반 목록을 사람이 읽기 좋은 한 문자열로 */
function formatViolations(violations) {
  if (violations.length === 0) return '위반 없음';
  return violations.map((v, i) => `${i + 1}. [${v.type}] ${v.detail}`).join('\n');
}

module.exports = { probeOverflow, formatViolations };
