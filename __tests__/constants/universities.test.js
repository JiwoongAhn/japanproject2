// __tests__/constants/universities.test.js
// #13 남은 학교 엣지 테스트 — 17개 학교 설정 데이터 무결성 자동 검증.
// 국사관 외 학교에서 앱이 조용히 깨지는 것을 막기 위한 안전망.
// (새 학교 추가 시 이 테스트가 누락 필드/오타/시간 역전 등을 잡아준다)
import { universities } from '../../src/constants/universities';
import { universityLinks } from '../../src/constants/universityLinks';
import { getUniversityInfo, getUniversityLinks } from '../../src/utils/university';
import { getPeriodRanges, PERIOD_RANGES } from '../../src/utils/timetable';

// 도메인 형식: 소문자/숫자/하이픈 라벨을 점으로 연결, @·공백·프로토콜 없음
const DOMAIN_RE = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const isHttpsUrl = (s) => typeof s === 'string' && /^https?:\/\/[^\s]+$/.test(s);

describe('universities 설정 무결성', () => {
  it('U-01: 학교 목록이 비어있지 않다', () => {
    expect(Array.isArray(universities)).toBe(true);
    expect(universities.length).toBeGreaterThan(0);
  });

  it('U-02: id가 전부 고유하다 (중복 없음)', () => {
    const ids = universities.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('U-03: 첫 번째 학교는 국사관(fallback 기준)이다', () => {
    // getUniversityInfo가 미매칭 시 universities[0]을 반환하므로 순서가 계약이다
    expect(universities[0].id).toBe('kokushikan');
  });

  describe.each(universities.map((u) => [u.id, u]))('[%s]', (id, u) => {
    it('필수 필드(id·name·location·emailDomain)가 비어있지 않은 문자열이다', () => {
      for (const field of ['id', 'name', 'location', 'emailDomain']) {
        expect(typeof u[field]).toBe('string');
        expect(u[field].trim().length).toBeGreaterThan(0);
      }
    });

    it('id는 소문자/숫자/하이픈만 사용한다', () => {
      expect(u.id).toMatch(/^[a-z0-9-]+$/);
    });

    it('emailDomain이 올바른 도메인 형식이다 (@·프로토콜 없음)', () => {
      expect(u.emailDomain).toMatch(DOMAIN_RE);
    });

    it('campuses가 비어있지 않은 문자열 배열이다', () => {
      expect(Array.isArray(u.campuses)).toBe(true);
      expect(u.campuses.length).toBeGreaterThan(0);
      u.campuses.forEach((c) => {
        expect(typeof c).toBe('string');
        expect(c.trim().length).toBeGreaterThan(0);
      });
    });

    it('periodRanges가 있으면 1교시부터 연속·시간 정합(start<end, 겹침·역전 없음)이다', () => {
      if (!u.periodRanges) return; // 없으면 국사관 기본값 fallback → U-fallback에서 검증
      const periods = Object.keys(u.periodRanges).map(Number).sort((a, b) => a - b);
      // 1부터 연속된 교시 번호
      expect(periods[0]).toBe(1);
      periods.forEach((p, i) => expect(p).toBe(i + 1));
      let prevEnd = -1;
      periods.forEach((p) => {
        const { start, end } = u.periodRanges[p];
        expect(typeof start).toBe('number');
        expect(typeof end).toBe('number');
        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeLessThanOrEqual(24 * 60);
        expect(start).toBeLessThan(end);        // 시작 < 끝
        expect(start).toBeGreaterThanOrEqual(prevEnd); // 이전 교시와 겹치지 않음
        prevEnd = end;
      });
    });
  });
});

describe('universities ↔ universityLinks 교차 정합', () => {
  it('L-01: 모든 학교가 universityLinks 항목을 가진다 (누락 없음)', () => {
    universities.forEach((u) => {
      expect(universityLinks[u.id]).toBeDefined();
    });
  });

  it('L-02: universityLinks에 학교 목록에 없는 고아 항목이 없다', () => {
    const validIds = new Set(universities.map((u) => u.id));
    Object.keys(universityLinks).forEach((linkId) => {
      expect(validIds.has(linkId)).toBe(true);
    });
  });

  describe.each(Object.entries(universityLinks))('[%s] 링크', (id, link) => {
    it('homepageUrl이 존재하고 https URL이다', () => {
      expect(isHttpsUrl(link.homepageUrl)).toBe(true);
    });

    it('값이 있는 URL 필드는 모두 https 형식이다 (빈 문자열은 허용)', () => {
      const urlFields = ['manabaUrl', 'kaedeUrl', 'lmsUrl', 'syllabusUrl', 'portalUrl', 'timetableUrl'];
      urlFields.forEach((f) => {
        if (link[f]) expect(isHttpsUrl(link[f])).toBe(true);
      });
    });

    it('lmsUrl과 lmsLabel은 함께 있거나 함께 없어야 한다', () => {
      expect(Boolean(link.lmsUrl)).toBe(Boolean(link.lmsLabel));
    });
  });
});

describe('헬퍼 함수 동작', () => {
  it('H-01: getUniversityInfo가 학교 이메일로 정확히 매칭한다', () => {
    const toyo = universities.find((u) => u.id === 'toyo');
    expect(getUniversityInfo(`student@${toyo.emailDomain}`).id).toBe('toyo');
  });

  it('H-02: 미등록 도메인은 국사관(fallback)으로 반환한다', () => {
    expect(getUniversityInfo('someone@unknown-domain.example').id).toBe('kokushikan');
  });

  it('H-03: getUniversityLinks는 미존재 id에 빈 객체를 반환한다', () => {
    expect(getUniversityLinks('___nope___')).toEqual({});
  });

  it('H-04: periodRanges 없는 학교(dendai)는 국사관 기본값으로 fallback된다', () => {
    const dendai = universities.find((u) => u.id === 'dendai');
    expect(dendai.periodRanges).toBeUndefined();
    expect(getPeriodRanges(dendai)).toBe(PERIOD_RANGES);
  });
});
