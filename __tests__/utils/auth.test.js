// __tests__/utils/auth.test.js
import { buildEmail } from '../../src/utils/auth';

describe('buildEmail', () => {
  // AU-01: 정상 입력
  it('AU-01: buildEmail("A1234567", "kokushikan") → "A1234567@kokushikan.unipas"', () => {
    expect(buildEmail('A1234567', 'kokushikan')).toBe('A1234567@kokushikan.unipas');
  });

  // AU-02: 앞뒤 공백 제거
  it('AU-02: 앞뒤 공백이 있는 studentId는 trim 후 처리한다', () => {
    expect(buildEmail('  A1234567  ', 'kokushikan')).toBe('A1234567@kokushikan.unipas');
  });

  // AU-03: universityId가 null이면 기본값 'kokushikan' 사용
  it('AU-03: universityId가 null이면 "A1234567@kokushikan.unipas" 반환', () => {
    expect(buildEmail('A1234567', null)).toBe('A1234567@kokushikan.unipas');
  });

  // AU-04: universityId가 undefined이면 기본값 'kokushikan' 사용
  it('AU-04: universityId가 undefined이면 "A1234567@kokushikan.unipas" 반환', () => {
    expect(buildEmail('A1234567', undefined)).toBe('A1234567@kokushikan.unipas');
  });
});
