import { parseCoachFlag, shouldShowCoachOnTap } from '../../src/utils/noticeCoach';

describe('noticeCoach — 공지 첫 탭 코치 표시 로직', () => {
  describe('parseCoachFlag', () => {
    it("'1'이면 이미 본 것으로 true", () => {
      expect(parseCoachFlag('1')).toBe(true);
    });
    it('null(플래그 없음)이면 false', () => {
      expect(parseCoachFlag(null)).toBe(false);
    });
    it("'1' 이외의 값('0'/''/undefined)은 false", () => {
      expect(parseCoachFlag('0')).toBe(false);
      expect(parseCoachFlag('')).toBe(false);
      expect(parseCoachFlag(undefined)).toBe(false);
    });
  });

  describe('shouldShowCoachOnTap', () => {
    it('아직 안 본(false) 사용자만 코치를 띄운다', () => {
      expect(shouldShowCoachOnTap(false)).toBe(true);
    });
    it('이미 본(true) 사용자는 바로 이동 (코치 X)', () => {
      expect(shouldShowCoachOnTap(true)).toBe(false);
    });
    it('플래그 로드 전(null)이면 붙잡지 않고 바로 이동 (레이스 방지)', () => {
      expect(shouldShowCoachOnTap(null)).toBe(false);
    });
  });

  describe('전체 시나리오: 신규 → 첫 탭 → 재실행', () => {
    it('신규 사용자: 플래그 없음 → 첫 탭에서 코치 표시', () => {
      const coachShown = parseCoachFlag(null); // 마운트 시 읽음
      expect(coachShown).toBe(false);
      expect(shouldShowCoachOnTap(coachShown)).toBe(true); // 첫 탭 → 코치
    });
    it('코치를 본 뒤 재실행: 플래그 "1" → 탭해도 코치 안 뜸', () => {
      const coachShown = parseCoachFlag('1');
      expect(coachShown).toBe(true);
      expect(shouldShowCoachOnTap(coachShown)).toBe(false); // 바로 이동
    });
  });
});
