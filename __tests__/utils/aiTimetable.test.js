import { normalizeAiCourses, countAiTerms } from '../../src/utils/aiTimetable';
import { buildCourseRows } from '../../src/utils/timetable';

const course = (over = {}) => ({
  name: '憲法B', professor: '鈴木 照夫', room: '3201', day: 'mon', period: 2, term: 'fall', ...over,
});

describe('normalizeAiCourses', () => {
  test('AI-01: 요일·교시가 있으면 parsed + high', () => {
    const { parsed, unparsed } = normalizeAiCourses([course()]);
    expect(unparsed).toEqual([]);
    expect(parsed).toEqual([{
      name: '憲法B', day: 0, period: 2, term: 'fall',
      professor: '鈴木 照夫', room: '3201', confidence: 'high',
    }]);
  });

  test('AI-02: 요일·교시 모름 → null + low (미리보기에서 사용자가 지정)', () => {
    const { parsed } = normalizeAiCourses([course({ day: 'unknown', period: 0 })]);
    expect(parsed[0]).toMatchObject({ day: null, period: null, confidence: 'low' });
  });

  test('AI-03: 토요일·9교시 이상은 low (月~金·1~8 만 저장 가능)', () => {
    const { parsed } = normalizeAiCourses([
      course({ day: 'sat', period: 1 }),
      course({ name: '夜間', day: 'tue', period: 9 }),
    ]);
    expect(parsed.map((p) => p.confidence)).toEqual(['low', 'low']);
    expect(parsed[0].day).toBe(5);
    expect(parsed[1].period).toBe(9);
  });

  test('AI-04: 범위 밖·이상한 값은 모름으로 처리', () => {
    const { parsed } = normalizeAiCourses([course({ day: 'sun', period: 11, term: 'year' })]);
    expect(parsed[0]).toMatchObject({ day: null, period: null, term: null, confidence: 'low' });
  });

  test('AI-05: 과목명이 없거나 공백뿐이면 버린다', () => {
    const { parsed } = normalizeAiCourses([course({ name: '' }), course({ name: '   ' }), course({ name: null })]);
    expect(parsed).toEqual([]);
  });

  test('AI-06: 빈 교수·교실은 null, 공백은 하나로', () => {
    const { parsed } = normalizeAiCourses([course({ professor: '', room: '  34B  303 ' })]);
    expect(parsed[0].professor).toBeNull();
    expect(parsed[0].room).toBe('34B 303');
  });

  test('AI-07: 같은 과목·요일·교시 중복 제거 (스크린샷이 겹칠 때)', () => {
    const { parsed } = normalizeAiCourses([course(), course(), course({ day: 'thu' })]);
    expect(parsed).toHaveLength(2);
  });

  test('AI-08: term 옵션 — 다른 학기는 빼고, 학기 모름은 남긴다', () => {
    const { parsed } = normalizeAiCourses(
      [course({ term: 'spring' }), course({ name: 'A', term: 'fall' }), course({ name: 'B', term: 'unknown' })],
      { term: 'fall' },
    );
    expect(parsed.map((p) => p.name)).toEqual(['A', 'B']);
  });

  test('AI-09: 배열이 아니면 빈 결과 (서버 응답 이상에도 안 죽는다)', () => {
    expect(normalizeAiCourses(undefined)).toEqual({ parsed: [], unparsed: [] });
    expect(normalizeAiCourses({ courses: [] })).toEqual({ parsed: [], unparsed: [] });
    expect(normalizeAiCourses([null, 1, 'x'])).toEqual({ parsed: [], unparsed: [] });
  });

  test('AI-10: 너무 긴 이름은 잘라낸다', () => {
    const { parsed } = normalizeAiCourses([course({ name: 'あ'.repeat(100) })]);
    expect(parsed[0].name).toHaveLength(60);
  });

  test('AI-11: buildCourseRows 와 연결 — high 만 저장되고 low 는 invalid', () => {
    const { parsed } = normalizeAiCourses([course(), course({ name: '観光ビジネス論', day: 'unknown', period: 0 })]);
    const { rows, skipped } = buildCourseRows(parsed, 'u1', [], { term: 'fall' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: '憲法B', day_of_week: 0, period: 2, room: '3201', term: 'fall' });
    expect(skipped[0].reason).toBe('invalid');
  });
});

describe('countAiTerms', () => {
  test('학기별 개수 (모름 포함)', () => {
    const { parsed } = normalizeAiCourses([
      course({ term: 'spring' }), course({ name: 'A' }), course({ name: 'B', term: 'unknown' }),
    ]);
    expect(countAiTerms(parsed)).toEqual({ spring: 1, fall: 1, unknown: 1 });
    expect(countAiTerms(undefined)).toEqual({ spring: 0, fall: 0, unknown: 0 });
  });
});

describe('cleanPageHtml', () => {
  const { cleanPageHtml } = require('../../src/utils/aiTimetable');

  test('CP-01: 스크립트·스타일·주석 제거, 표 구조와 글자는 유지', () => {
    const html = '<body><script>var pw="x"</script><style>td{}</style><!-- c -->'
      + '<table class="t" id="tt"><tr><td rowspan="2" style="color:red">月1<br>憲法B</td></tr></table></body>';
    expect(cleanPageHtml(html)).toBe('<body><table><tr><td rowspan="2">月1\n憲法B</td></tr></table></body>');
  });

  test('CP-02: 입력칸·이미지·빈 래퍼 제거 (비밀번호 칸 값이 따라가지 않게)', () => {
    const html = '<form><input type="password" value="secret"><img src="a.png"><div class="x"> </div>時間割</form>';
    const out = cleanPageHtml(html);
    expect(out).not.toMatch(/secret|password|img|div/);
    expect(out).toBe('<form>時間割</form>');
  });

  test('CP-03: colspan 유지, 대문자 태그 소문자화, 공백 정리', () => {
    expect(cleanPageHtml('<TD COLSPAN=3 class="a">  火曜   5限 </TD>')).toBe('<td COLSPAN=3> 火曜 5限 </td>');
  });

  test('CP-04: 문자열이 아니면 빈 문자열', () => {
    expect(cleanPageHtml(null)).toBe('');
  });

  test('CP-05: 실제 크기 감소 — 속성이 많은 PC 화면 표가 크게 줄어든다', () => {
    const cell = '<td class="cell-style-long" onclick="openSyllabus(12345)" style="width:120px;background:#fff">企業戦略実習<br>小久保</td>';
    const html = `<table>${'<tr>' + cell.repeat(6) + '</tr>'}</table>`.repeat(10);
    expect(cleanPageHtml(html).length).toBeLessThan(html.length / 3);
  });
});

describe('미리보기 정리', () => {
  const { sortForPreview, pickTermResult, decideTerm, buildSiteGuide } = require('../../src/utils/aiTimetable');
  const it_ = (name, day, period, term, confidence = 'high') => ({ name, day, period, term, confidence });

  test('PV-01: 확인 필요(low)가 맨 위, 나머지는 요일→교시 순', () => {
    const out = sortForPreview([it_('B', 1, 1, 'fall'), it_('A', 0, 3, 'fall'), it_('Z', null, null, 'fall', 'low'), it_('C', 0, 1, 'fall')]);
    expect(out.map((x) => x.name)).toEqual(['Z', 'C', 'A', 'B']);
  });

  test('PV-02: 고른 학기 + 학기 모름만 남긴다', () => {
    const r = pickTermResult([it_('春', 0, 1, 'spring'), it_('秋', 0, 2, 'fall'), it_('?', 0, 3, null)], 'fall');
    expect(r.parsed.map((x) => x.name)).toEqual(['秋', '?']);
    expect(r.unparsed).toEqual([]);
  });

  test('PV-03: 학기 결정 — 둘 다 있으면 묻고, 한쪽만이면 그 학기, 모르면 지금 학기', () => {
    expect(decideTerm({ spring: 3, fall: 2 }, 'fall')).toEqual({ ask: true, term: 'fall' });
    expect(decideTerm({ spring: 0, fall: 11, unknown: 1 }, 'spring')).toEqual({ ask: false, term: 'fall' });
    expect(decideTerm({ spring: 4, fall: 0 }, 'fall')).toEqual({ ask: false, term: 'spring' });
    expect(decideTerm({ spring: 0, fall: 0, unknown: 5 }, 'fall')).toEqual({ ask: false, term: 'fall' });
  });

  test('PV-04: 안내 띠 — 메뉴 경로가 있으면 함께 보여준다', () => {
    expect(buildSiteGuide('時間割表 → 本人')).toContain('時間割表 → 本人');
    expect(buildSiteGuide(null)).toBe('時間割が表示されたら、左下のボタンを押してください');
  });
});

describe('학교 설정', () => {
  const { universityLinks } = require('../../src/constants/universityLinks');

  test('UL-AI-01: 国士舘은 AI 설정이 없다 (기존 kaede 방식 유지 — 사용자 방침)', () => {
    expect(universityLinks.kokushikan.aiTimetableUrl).toBeUndefined();
    expect(universityLinks.kokushikan.timetableUrl).toBeTruthy();
  });

  test('UL-AI-02: AI 시작 주소는 https 이고 이름이 함께 있다', () => {
    for (const [id, l] of Object.entries(universityLinks)) {
      if (!l.aiTimetableUrl) continue;
      expect([id, l.aiTimetableUrl.startsWith('https://')]).toEqual([id, true]);
      expect([id, !!l.aiTimetableLabel]).toEqual([id, true]);
    }
  });
});

describe('明治大学 (2026-10-19 원문 재검증 결과 고정)', () => {
  const { universities } = require('../../src/constants/universities');
  const { universityLinks } = require('../../src/constants/universityLinks');
  const meiji = universities.find((u) => u.id === 'meiji');

  test('MJ-01: 시간표는 LMS(Oh-o! Meiji)가 아니라 教務システム(Campus-Xs)에서 읽는다', () => {
    expect(universityLinks.meiji.aiTimetableUrl).toBe('https://meiji-kyomu.mind.meiji.ac.jp/campusweb/top.do');
    expect(universityLinks.meiji.aiTimetableGuide).toContain('My時間割');
    // 旧 Oh-o! Meiji(oh-o2)는 2024년도 이전 수업용 — 다시 들어오지 않게
    expect(JSON.stringify(universityLinks.meiji)).not.toContain('oh-o2');
  });

  test('MJ-02: 학번 주소(메일 안 옴)로 가입하지 않도록 입력 예시·안내가 있다', () => {
    expect(meiji.emailDomain).toBe('meiji.ac.jp');
    expect(meiji.emailLocalHint).not.toBe('学籍番号');
    expect(meiji.emailNote).toContain('学生番号ではなく');
  });

  test('MJ-03: 100분×6교시, 자동로그인 OFF', () => {
    expect(meiji.periodRanges[1]).toEqual({ start: 540, end: 640 });
    expect(meiji.periodRanges[6]).toEqual({ start: 1140, end: 1240 });
    expect(universityLinks.meiji.autoLoginHosts ?? []).toEqual([]);
  });
});

describe('一括 스크린샷 안내 (2026-10-21: 스크린샷 방법만 안내)', () => {
  const { buildScreenshotSteps } = require('../../src/utils/aiTimetable');
  const { SHOW_OTHER_METHODS } = require('../../src/components/AiImportSheet');
  const { universityLinks } = require('../../src/constants/universityLinks');

  test('SS-01: 학교 시스템 이름·메뉴 경로가 1단계에 들어간다 (日本文理)', () => {
    const l = universityLinks.nbu;
    const steps = buildScreenshotSteps(l.aiTimetableLabel, l.aiTimetableGuide);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toBe('ユニバーサルパスポートで自分の時間割を開いて、スクショを撮る（時間割表 → 本人）');
  });

  test('SS-02: 이름·경로가 없는 학교는 일반 문구', () => {
    expect(buildScreenshotSteps(null, null)[0]).toBe('大学のサイトで自分の時間割を開いて、スクショを撮る');
    expect(buildScreenshotSteps('DUET', null)[0]).toBe('DUETで自分の時間割を開いて、スクショを撮る');
  });

  test('SS-03: 학교 사이트·붙여넣기 방법은 숨김 상태 (정보 모은 뒤 수정)', () => {
    expect(SHOW_OTHER_METHODS).toBe(false);
  });
});
