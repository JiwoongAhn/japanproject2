import {
  DEFAULT_MANABA_ORIGIN,
  manabaOriginFrom,
  manabaUrlsFor,
} from '../../src/constants/manaba';
import { universityLinks } from '../../src/constants/universityLinks';

// [배경] manaba URL이 'https://kokushikan.manaba.jp/...' 로 하드코딩되어 있어서,
//   東洋大·大東文化大·亜細亜大 학생이 manaba를 눌러도 국사관 로그인 화면이 떴다.
//   manaba는 학교마다 서브도메인만 다르고 경로(/ct/login 등)는 제품 공통이므로,
//   origin만 학교별로 갈아끼우는 구조가 맞다.
describe('manabaOriginFrom', () => {
  it('로그인 경로가 붙어 있어도 origin만 뽑는다', () => {
    expect(manabaOriginFrom('https://kokushikan.manaba.jp/ct/login')).toBe(
      'https://kokushikan.manaba.jp'
    );
  });

  it('origin만 등록된 값도 그대로 처리한다', () => {
    expect(manabaOriginFrom('https://daito.manaba.jp')).toBe('https://daito.manaba.jp');
  });

  it('manaba를 쓰지 않는 학교(빈 값)는 null', () => {
    [undefined, null, '', '   '].forEach((v) => {
      expect(manabaOriginFrom(v)).toBeNull();
    });
  });
});

describe('manabaUrlsFor', () => {
  it('학교 origin에서 4개 엔드포인트를 만든다', () => {
    const u = manabaUrlsFor('https://daito.manaba.jp');
    expect(u.login).toBe('https://daito.manaba.jp/ct/login');
    expect(u.home).toBe('https://daito.manaba.jp/ct/home');
    expect(u.logout).toBe('https://daito.manaba.jp/ct/logout');
    expect(u.reminder).toBe('https://daito.manaba.jp/ct/home_preferences_reminder');
  });

  it('origin이 없으면 null (호출부가 진입을 막아야 함)', () => {
    expect(manabaUrlsFor(null)).toBeNull();
    expect(manabaUrlsFor('')).toBeNull();
  });

  it('기본 origin은 국사관이며 기존 URL과 동일하다 (회귀 방지)', () => {
    expect(manabaUrlsFor(DEFAULT_MANABA_ORIGIN).login).toBe(
      'https://kokushikan.manaba.jp/ct/login'
    );
  });
});

describe('manaba 사용 학교의 링크가 origin으로 변환된다', () => {
  it('등록된 manabaUrl은 모두 origin 추출에 성공해야 한다', () => {
    const withManaba = Object.entries(universityLinks).filter(
      ([, links]) => links.manabaUrl
    );
    // 최소한 국사관은 있어야 함 (링크 파일이 비어버리는 회귀 감지)
    expect(withManaba.length).toBeGreaterThan(0);
    withManaba.forEach(([id, links]) => {
      const origin = manabaOriginFrom(links.manabaUrl);
      expect(origin).not.toBeNull();
      expect(manabaUrlsFor(origin).login.endsWith('/ct/login')).toBe(true);
      // 국사관 이외 학교가 국사관 서버를 가리키고 있으면 잘못된 등록이다
      if (id !== 'kokushikan') {
        expect(origin).not.toContain('kokushikan');
      }
    });
  });
});

// ── 회귀 방지: 타 학교가 국사관 서버로 새지 않는가 ──────────────
// [사고 이력] manaba URL을 학교별로 바꾸면서 `?? DEFAULT_MANABA_ORIGIN`(국사관) 폴백을
//   넣었더니, manaba를 쓰지 않는 13개 학교가 전부 국사관 manaba를 가리키게 됐다.
//   화면 진입 게이트(supportsManaba)가 이 폴백을 막는 마지막 방어선이다.
describe('타 학교가 국사관 서버로 새지 않는다', () => {
  const { universities } = require('../../src/constants/universities');
  const { getSyllabusUrl } = require('../../src/utils/syllabusRoom');

  it('manaba 미사용 학교는 manaba 화면 진입이 차단된다', () => {
    universities.forEach((u) => {
      const links = universityLinks[u.id] ?? {};
      // supportsManaba가 false면 화면이 Alert 후 goBack 하므로 서버 접속이 없다
      if (!links.manabaUrl) {
        expect(require('../../src/constants/manaba').supportsManaba(links.manabaUrl)).toBe(false);
      }
    });
  });

  it('국사관 이외 어떤 학교도 국사관 서버를 가리키지 않는다', () => {
    const { supportsManaba } = require('../../src/constants/manaba');
    universities
      .filter((u) => u.id !== 'kokushikan')
      .forEach((u) => {
        const links = universityLinks[u.id] ?? {};

        // ① manaba: 진입이 허용되는 학교라면, 그 주소가 국사관이어서는 안 된다
        if (supportsManaba(links.manabaUrl)) {
          expect(manabaOriginFrom(links.manabaUrl)).not.toContain('kokushikan');
        }

        // ② 시라바스: 조회가 허용되는 학교라면, 그 주소가 국사관이어서는 안 된다
        const syl = getSyllabusUrl(u.id);
        if (syl) expect(syl).not.toContain('kokushikan');
      });
  });
});
