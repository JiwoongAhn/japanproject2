/**
 * @jest-environment jsdom
 */
import {
  buildKaedeCellId, buildSyllabusClickJS, extractSyllabusUid, KAEDE_SYLLABUS_VIEW_PATH,
} from '../../src/utils/syllabusLink';
import { parseKaedeCellId } from '../../src/utils/timetable';

describe('buildKaedeCellId', () => {
  test('月1限 春期 → Cell1_1_Spring', () => {
    expect(buildKaedeCellId({ day: 0, period: 1, term: 'spring' })).toBe('Cell1_1_Spring');
  });
  test('木3限 秋期 → Cell4_3_Autumn', () => {
    expect(buildKaedeCellId({ day: 3, period: 3, term: 'fall' })).toBe('Cell4_3_Autumn');
  });
  test('term 없음(구버전 데이터)은 Spring 취급', () => {
    expect(buildKaedeCellId({ day: 2, period: 5 })).toBe('Cell3_5_Spring');
    expect(buildKaedeCellId({ day: 2, period: 5, term: null })).toBe('Cell3_5_Spring');
  });
  test('parseKaedeCellId와 정확히 역변환', () => {
    for (let day = 0; day <= 5; day++) {
      for (let period = 1; period <= 7; period++) {
        for (const term of ['spring', 'fall']) {
          const id = buildKaedeCellId({ day, period, term });
          expect(parseKaedeCellId(id)).toEqual({ day, period, term });
        }
      }
    }
  });
  test('잘못된 입력은 null', () => {
    expect(buildKaedeCellId({ day: 6, period: 1 })).toBeNull();
    expect(buildKaedeCellId({ day: -1, period: 1 })).toBeNull();
    expect(buildKaedeCellId({ day: 0, period: 0 })).toBeNull();
    expect(buildKaedeCellId({ day: '0', period: 1 })).toBeNull();
    expect(buildKaedeCellId()).toBeNull();
  });
});

describe('extractSyllabusUid', () => {
  test('실측 onclick 문자열에서 uid 추출', () => {
    expect(extractSyllabusUid('OpenSyllabusWindow(406939);return false;')).toBe('406939');
    expect(extractSyllabusUid('OpenSyllabusWindow( 12 )')).toBe('12');
  });
  test('형식이 다르면 null', () => {
    expect(extractSyllabusUid('__doPostBack(\'a\',\'b\')')).toBeNull();
    expect(extractSyllabusUid('')).toBeNull();
    expect(extractSyllabusUid(null)).toBeNull();
  });
});

// 주입 JS를 가짜 DOM에서 실제로 실행해 본다 (ReactNativeWebView / location 은 스텁)
function runInjected(cellHtml, cellId = 'Cell1_1_Spring') {
  document.body.innerHTML = `<table><tr>${cellHtml}</tr></table>`; // td는 table 밖에선 파서가 버림
  const messages = [];
  const nav = [];
  const fakeLocation = { origin: 'https://kaedei.kokushikan.ac.jp', set href(v) { nav.push(v); } };
  const fn = new Function(
    'window', 'document', 'location',
    buildSyllabusClickJS(cellId)
  );
  const fakeWindow = { ReactNativeWebView: { postMessage: (s) => messages.push(JSON.parse(s)) } };
  fn(fakeWindow, document, fakeLocation);
  return { messages, nav };
}

describe('buildSyllabusClickJS', () => {
  test('실측 구조(OpenSyllabusWindow)면 같은 창에서 시라바스 URL로 이동', () => {
    const { messages, nav } = runInjected(
      '<td id="Cell1_1_Spring" class="cell"><span class="lecture_name">ビジネスコミュニケーション</span>' +
      '<a href="#" onclick="OpenSyllabusWindow(406939);return false;">シラバス</a></td>'
    );
    expect(messages).toEqual([{ type: 'syllabusClick', ok: true, reason: 'uid', cellId: 'Cell1_1_Spring' }]);
    expect(nav).toEqual([`https://kaedei.kokushikan.ac.jp${KAEDE_SYLLABUS_VIEW_PATH}406939`]);
  });
  test('셀이 없으면 cellNotFound 보고, 이동 없음', () => {
    const { messages, nav } = runInjected('<td id="Cell2_2_Spring" class="cell"></td>');
    expect(messages[0]).toMatchObject({ ok: false, reason: 'cellNotFound' });
    expect(nav).toEqual([]);
  });
  test('셀은 있는데 시라바스 링크가 없으면 linkNotFound', () => {
    const { messages, nav } = runInjected('<td id="Cell1_1_Spring" class="cell"><span class="lecture_name">X</span></td>');
    expect(messages[0]).toMatchObject({ ok: false, reason: 'linkNotFound' });
    expect(nav).toEqual([]);
  });
  test('따옴표가 섞인 id도 이스케이프됨(주입 방지)', () => {
    expect(buildSyllabusClickJS('a"b')).toContain('getElementById("a\\"b")');
  });
});
