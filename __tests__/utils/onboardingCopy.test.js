// __tests__/utils/onboardingCopy.test.js
// 온보딩 문구가 학교 링크에 맞게 분기되는지 (국사관 회귀 + 타 대학 케이스)
import { buildOnboardingCopy, loginTargetsFor } from '../../src/utils/onboardingCopy';
import { universityLinks } from '../../src/constants/universityLinks';

const keys = (c) => c.slides.map((s) => s.key);

describe('buildOnboardingCopy', () => {
  it('O-01: 국사관 = 6슬라이드 전부 + manaba CTA + kaede-i 가져오기 + 課題 자동 추가', () => {
    const c = buildOnboardingCopy(universityLinks.kokushikan);
    expect(keys(c)).toEqual(['timetable', 'manabaPush', 'assignment', 'review', 'community', 'oneTimeLogin']);
    expect(c.slides[0].title).toContain('学校のシステムから');
    expect(c.slides[0].subtitle).toContain('kaede-iにログイン');
    expect(c.slides[2]).toMatchObject({ title: '課題は、自動でリストに', autoAdd: true });
    expect(c.slides[2].subtitle).toContain('3日前と前日、18時');
    expect(c.slides[5].subtitle).toContain('manabaとkaede-i');
    expect(c.slides[5].afterText).toBe('あとは自動でつながります');
    expect(c.showMailConnectCta).toBe(true);
    expect(c.summaryItems).toEqual([
      '学校のシステムから時間割を取り込み',
      'manabaのお知らせ・課題が自動で届く',
      '課題の締切を3日前と前日にお知らせ',
      '授業評価と匿名掲示板も使える',
    ]);
    expect(c.summaryLead).toContain('最初のログイン1回');
    expect(c.summaryLead).toContain('お知らせと課題が自動で届きます');
    // 옛 문구(실제 기능과 안 맞던 것)가 남아 있지 않다
    expect(JSON.stringify(c)).not.toMatch(/コピペ|一覧でお知らせ/);
  });

  it('O-02: 쿠키유지만 되는 학교(nbu, autoLoginHosts 없음) = manaba 슬라이드 없음, 스크린샷 가져오기, "자동" 약속 안 함', () => {
    const c = buildOnboardingCopy(universityLinks.nbu);
    expect(keys(c)).toEqual(['timetable', 'assignment', 'review', 'community', 'oneTimeLogin']);
    expect(c.slides[0].title).toBe('時間割は、スクショで取り込み');
    // 課題 자동 추가는 manaba 학교만 → 마감 전날 알림만 약속
    expect(c.slides[1]).toMatchObject({ key: 'assignment', title: '課題の締切、\n3日前と前日にお知らせ', autoAdd: false });
    expect(c.slides[1].subtitle).not.toContain('自動');
    const last = c.slides[c.slides.length - 1];
    expect(last.targets).toEqual(['UNIPA']);
    expect(last.subtitle).toContain('UNIPA');
    expect(last.subtitle).not.toContain('自動');
    expect(c.showMailConnectCta).toBe(false);
    expect(c.summaryItems).toContain('UNIPAにアプリ内でアクセス');
    expect(c.summaryItems).toContain('スクショで時間割をまとめて登録');
    expect(c.summaryItems).toContain('課題の締切を3日前と前日にお知らせ');
    expect(c.summaryItems.join()).not.toContain('manaba');
  });

  it('O-02b: 자동입력 검증 대기 학교(kanagawa-u, autoLoginCandidates 만) = "자동" 약속 안 함', () => {
    // 2026-10-14 방침: 실기 검증 전 학교는 자동입력 OFF → 쿠키 유지 문구
    const c = buildOnboardingCopy(universityLinks['kanagawa-u']);
    const last = c.slides[c.slides.length - 1];
    expect(last.title).toBe('学校のシステムに、アプリからそのまま');
    expect(last.subtitle).toContain('WebClassは');
    expect(last.subtitle).not.toContain('自動');
    expect(c.summaryLead).not.toContain('おまかせ');
    expect(c.showMailConnectCta).toBe(false);
  });

  it('O-03: autoLoginHosts 있는 비-manaba 학교 = "자동으로 이어짐" 문구', () => {
    const c = buildOnboardingCopy({
      homepageUrl: 'https://x', lmsUrl: 'https://lms.x', lmsLabel: 'UNIPA', autoLoginHosts: ['lms.x'],
    });
    const last = c.slides[c.slides.length - 1];
    expect(last.title).toBe('最初の1回だけ、ログイン');
    expect(last.subtitle).toContain('UNIPAは');
    expect(c.summaryLead).toContain('最初のログイン1回');
    // manaba 가 없으니 "お知らせ·課題가 자동" 은 약속하지 않는다
    expect(c.summaryLead).not.toContain('お知らせ');
  });

  it('O-03b: manaba 학교 중 kaede 전용 파서 없는 곳(toyo) = 스크린샷 가져오기 + 課題 자동 추가', () => {
    const c = buildOnboardingCopy(universityLinks.toyo);
    expect(c.slides[0].title).toBe('時間割は、スクショで取り込み');
    expect(keys(c)).toContain('manabaPush');
    expect(c.slides.find((s) => s.key === 'assignment').autoAdd).toBe(true);
    expect(c.showMailConnectCta).toBe(true);
  });

  it('O-04: 홈페이지만 있는 학교(nihon-u) = 로그인 슬라이드 없음, 요약 3항목', () => {
    const c = buildOnboardingCopy(universityLinks['nihon-u']);
    expect(keys(c)).toEqual(['timetable', 'assignment', 'review', 'community']);
    expect(c.summaryItems).toHaveLength(3);
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
