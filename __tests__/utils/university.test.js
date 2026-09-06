import { findUniversityByEmail, getUniversityInfo, getUniversityLinks } from '../../src/utils/university';

// [배경] getUniversityInfo는 못 찾으면 국사관으로 폴백한다(화면이 빈 값으로 깨지지 않게).
//   그래서 "학교를 특정해야만 안전한 동작"(학교 서버 접속 등)의 판정에 쓰면
//   모르는 학교가 전부 국사관으로 취급되는 사고가 난다.
//   그런 판정에는 null을 돌려주는 findUniversityByEmail을 써야 한다.
describe('findUniversityByEmail', () => {
  it('등록된 도메인은 해당 학교를 찾는다', () => {
    expect(findUniversityByEmail('a@kokushikan.ac.jp')?.id).toBe('kokushikan');
    expect(findUniversityByEmail('b@toyo.jp')?.id).toBe('toyo');
  });

  it('모르는 도메인은 null (국사관으로 폴백하지 않는다)', () => {
    expect(findUniversityByEmail('c@example.com')).toBeNull();
    expect(findUniversityByEmail('d@unknown.ac.jp')).toBeNull();
  });

  it('이메일이 비어 있어도 안전하게 null', () => {
    [undefined, null, '', 'not-an-email'].forEach((v) => {
      expect(findUniversityByEmail(v)).toBeNull();
    });
  });

  it('도메인 전체를 비교한다 (st./stu. 접두사가 다른 학교와 섞이지 않게)', () => {
    // 부분 문자열 매칭이었다면 'kokushikan.ac.jp'가 'x.kokushikan.ac.jp'에도 걸린다
    expect(findUniversityByEmail('e@sub.kokushikan.ac.jp')).toBeNull();
  });
});

describe('getUniversityInfo (표시용 폴백)', () => {
  it('모르는 도메인은 국사관으로 폴백해 화면이 깨지지 않게 한다', () => {
    expect(getUniversityInfo('f@example.com')?.id).toBe('kokushikan');
  });

  it('아는 도메인은 그 학교를 그대로 준다', () => {
    expect(getUniversityInfo('g@toyo.jp')?.id).toBe('toyo');
  });
});

describe('getUniversityLinks', () => {
  it('모르는 학교 id는 빈 객체 (호출부의 옵셔널 접근이 안전해야 함)', () => {
    expect(getUniversityLinks('unknown')).toEqual({});
    expect(getUniversityLinks(undefined)).toEqual({});
  });
});
