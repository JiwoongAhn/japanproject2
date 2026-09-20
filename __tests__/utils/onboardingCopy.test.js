// __tests__/utils/onboardingCopy.test.js
// 온보딩 문구가 학교 링크에 맞게 분기되는지 (국사관 회귀 + 타 대학 케이스)
import { buildOnboardingCopy, loginTargetsFor } from '../../src/utils/onboardingCopy';
import { universityLinks } from '../../src/constants/universityLinks';

const keys = (c) => c.slides.map((s) => s.key);

describe('buildOnboardingCopy', () => {
  it('O-01: 국사관 = 6슬라이드 전부 + manaba CTA + 一括 문구 (회귀)', () => {
    const c = buildOnboardingCopy(universityLinks.kokushikan);
    expect(keys(c)).toEqual(['timetable', 'manabaPush', 'assignment', 'review', 'community', 'oneTimeLogin']);
    expect(c.slides[0].title).toContain('一括');
    expect(c.slides[5].subtitle).toContain('manabaとkaede-i');
    expect(c.slides[5].afterText).toBe('あとは自動でつながります');
    expect(c.showMailConnectCta).toBe(true);
    expect(c.summaryItems).toContain('コピペで時間割を一括登録');
    expect(c.summaryLead).toContain('最初のログイン1回');
  });

  it('O-02: WebClass 학교(kanagawa-u, autoLoginHosts 없음) = manaba 슬라이드 없음, 一括 대신 수동, 쿠키유지 문구', () => {
    const c = buildOnboardingCopy(universityLinks['kanagawa-u']);
    expect(keys(c)).toEqual(['timetable', 'assignment', 'review', 'community', 'oneTimeLogin']);
    expect(c.slides[0].title).not.toContain('一括');
    const last = c.slides[c.slides.length - 1];
    expect(last.targets).toEqual(['WebClass']);
    expect(last.subtitle).toContain('WebClass');
    expect(last.subtitle).not.toContain('自動');
    expect(c.showMailConnectCta).toBe(false);
    expect(c.summaryItems).toContain('WebClassにアプリ内でアクセス');
    expect(c.summaryItems.join()).not.toContain('manaba');
  });

  it('O-03: autoLoginHosts 있는 비-manaba 학교 = "자동으로 이어짐" 문구', () => {
    const c = buildOnboardingCopy({
      homepageUrl: 'https://x', lmsUrl: 'https://lms.x', lmsLabel: 'UNIPA', autoLoginHosts: ['lms.x'],
    });
    const last = c.slides[c.slides.length - 1];
    expect(last.title).toBe('最初の1回だけ、ログイン');
    expect(last.subtitle).toContain('UNIPAは');
    expect(c.summaryLead).toContain('最初のログイン1回');
  });

  it('O-04: 홈페이지만 있는 학교(nihon-u) = 로그인 슬라이드 없음, 요약 2항목', () => {
    const c = buildOnboardingCopy(universityLinks['nihon-u']);
    expect(keys(c)).toEqual(['timetable', 'assignment', 'review', 'community']);
    expect(c.summaryItems).toHaveLength(2);
    expect(c.showMailConnectCta).toBe(false);
  });

  it('O-05: links가 없어도 크래시 없이 최소 구성', () => {
    const c = buildOnboardingCopy(undefined);
    expect(keys(c)).toEqual(['timetable', 'assignment', 'review', 'community']);
  });

  it('O-06: loginTargetsFor 는 manaba/LMS 라벨 + 포털 라벨 순', () => {
    expect(loginTargetsFor(universityLinks.kokushikan)).toEqual(['manaba', 'kaede-i']);
    expect(loginTargetsFor(universityLinks.dendai)).toEqual(['UNIPA']);
    expect(loginTargetsFor({})).toEqual([]);
  });
});
