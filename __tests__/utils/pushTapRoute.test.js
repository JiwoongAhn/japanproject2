import { pushTapRoute } from '../../src/lib/notifications';

describe('pushTapRoute — 탭한 푸시가 여는 화면', () => {
  test('PT-01 締切前日 알림 → 課題 화면', () => {
    expect(pushTapRoute({ type: 'assignment_reminder' })).toEqual({ screen: 'Assignment' });
  });
  test('PT-02 manaba 통지(type 없음) → 통지 미리보기, 데이터 그대로', () => {
    const data = { noticeId: 'n1', subject: 's', noticeUrl: 'u', bodyHtml: 'b' };
    expect(pushTapRoute(data)).toEqual({ screen: 'NoticePreview', params: data });
  });
  test('PT-04 운영 안내 푸시(app_notice) → 화면 이동 없음 (빈 통지 창 방지)', () => {
    expect(pushTapRoute({ type: 'app_notice', campaign: 'x' })).toEqual({ screen: null });
  });
  test('PT-03 그 외 type(인증코드 등)은 기존 동작 유지', () => {
    expect(pushTapRoute({ type: 'manaba_auth_code' }).screen).toBe('NoticePreview');
    expect(pushTapRoute(undefined).screen).toBe('NoticePreview');
  });
});
