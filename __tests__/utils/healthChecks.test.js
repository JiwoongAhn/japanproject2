import {
  CHECKS,
  EXPECTED_CRON_JOBS,
  runChecks,
  buildPushMessage,
  buildEmail,
  isSemester,
  formatJstDate,
} from '../../supabase/functions/health-check/checks';

// 기준 시각 = cron 과 같은 JST 09:00 (2026-10-29 목, 학기 중)
const NOW = new Date('2026-10-29T09:00:00+09:00');
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600 * 1000).toISOString();

// 모든 것이 정상인 숫자 묶음
const healthy = (over = {}) => ({
  verified_subscriptions: 10,
  subs_without_push_token: 0,
  last_notice_at: hoursAgo(3),
  notices_24h: 20,
  ai_push_notices_24h: 5,
  ai_push_missing_24h: 0,
  push_24h: { delivered: 30 },
  push_retry_stuck: 0,
  cron_jobs: Object.fromEntries(
    Object.keys(EXPECTED_CRON_JOBS).map((name) => [name, { last_success: hoursAgo(0.2), failures_24h: 0 }]),
  ),
  http_errors_recent: 0,
  reports_24h: 0,
  identity_mismatch: 0,
  manaba_setup_stages: { none: 7, pending: 8, no_push: 6, ready: 4 },
  signups_24h: 1,
  posts_24h: 2,
  db_size_mb: 55,
  ...over,
});

const levelOf = (snap, id, now = NOW) => runChecks(snap, { now }).results.find((r) => r.id === id).level;

describe('점검 목록 형식 (새 점검을 추가할 때 지켜야 할 규칙)', () => {
  test('HC-00 모든 점검에 id·title·since(추가 계기)·run 이 있고 id 가 겹치지 않는다', () => {
    for (const c of CHECKS) {
      expect(typeof c.id).toBe('string');
      expect(typeof c.title).toBe('string');
      expect(c.since).toMatch(/^\d{4}-\d{2}-\d{2} /);
      expect(typeof c.run).toBe('function');
    }
    expect(new Set(CHECKS.map((c) => c.id)).size).toBe(CHECKS.length);
  });

  test('HC-01 정상 숫자면 🔴·🟠 가 하나도 없다', () => {
    const { worst } = runChecks(healthy(), { now: NOW });
    expect(['ok', 'info']).toContain(worst);
  });

  test('HC-02 점검 하나가 예외를 던져도 나머지는 계속하고, 예외는 🔴 로 보고한다', () => {
    const broken = [{ id: 'x', title: 'X', since: '2026-10-29 t', run: () => { throw new Error('boom'); } }, ...CHECKS];
    const { results, worst } = runChecks(healthy(), { now: NOW, checks: broken });
    expect(results).toHaveLength(CHECKS.length + 1);
    expect(results[0]).toMatchObject({ level: 'critical' });
    expect(worst).toBe('critical');
  });

  test('HC-03 숫자 묶음이 비어도 죽지 않는다', () => {
    expect(() => runChecks(null, { now: NOW })).not.toThrow();
  });
});

describe('manaba 공지 수신', () => {
  test('HC-10 학기 중 72시간 넘게 공지가 없으면 🔴', () => {
    expect(levelOf(healthy({ last_notice_at: hoursAgo(80) }), 'manaba-inbound')).toBe('critical');
  });
  test('HC-11 학기 중 48~72시간은 🟠 (주말일 수 있음)', () => {
    expect(levelOf(healthy({ last_notice_at: hoursAgo(50) }), 'manaba-inbound')).toBe('warn');
  });
  test('HC-12 방학(8월)에는 3일 조용해도 정상', () => {
    const summer = new Date('2026-08-20T09:00:00+09:00');
    const snap = healthy({ last_notice_at: new Date(summer.getTime() - 80 * 3600 * 1000).toISOString() });
    expect(levelOf(snap, 'manaba-inbound', summer)).toBe('ok');
  });
  test('HC-13 수신 설정한 학생이 없으면 판단하지 않는다', () => {
    expect(levelOf(healthy({ verified_subscriptions: 0, last_notice_at: null }), 'manaba-inbound')).toBe('ok');
  });
});

describe('알림을 못 받는 학생 (2026-10-29 발견: 10명 중 6명)', () => {
  test('HC-20 절반 이상이 알림 주소 없음 → 🟠', () => {
    expect(levelOf(healthy({ subs_without_push_token: 6 }), 'push-token-missing')).toBe('warn');
  });
  test('HC-21 소수면 ℹ️', () => {
    expect(levelOf(healthy({ subs_without_push_token: 1 }), 'push-token-missing')).toBe('info');
  });
});

describe('AI 요약', () => {
  test('HC-30 절반 이상 실패 → 🔴 (API 키 만료 의심)', () => {
    expect(levelOf(healthy({ ai_push_notices_24h: 6, ai_push_missing_24h: 6 }), 'ai-summary')).toBe('critical');
  });
  test('HC-31 가끔 실패는 ℹ️', () => {
    expect(levelOf(healthy({ ai_push_notices_24h: 10, ai_push_missing_24h: 1 }), 'ai-summary')).toBe('info');
  });
});

describe('자동 작업', () => {
  test('HC-40 마감 알림 작업이 26시간 넘게 성공 못 하면 🔴', () => {
    const snap = healthy();
    snap.cron_jobs['deadline-reminder-daily'].last_success = hoursAgo(30);
    expect(levelOf(snap, 'cron-jobs')).toBe('critical');
  });
  test('HC-41 작업이 사라지면 🔴', () => {
    const snap = healthy();
    delete snap.cron_jobs['push-retry-worker-hourly'];
    expect(levelOf(snap, 'cron-jobs')).toBe('critical');
  });
  test('HC-42 실패 기록이 있으면 🔴', () => {
    const snap = healthy();
    snap.cron_jobs['push-cleanup-daily'].failures_24h = 1;
    expect(levelOf(snap, 'cron-jobs')).toBe('critical');
  });
  test('HC-43 서버 함수 실패 응답만 있으면 🟠', () => {
    expect(levelOf(healthy({ http_errors_recent: 2 }), 'cron-jobs')).toBe('warn');
  });
});

describe('푸시·신고·용량·만료일', () => {
  test('HC-50 푸시 실패율 20% 이상 → 🟠', () => {
    expect(levelOf(healthy({ push_24h: { delivered: 8, dead: 2, permanent_fail: 1 } }), 'push-delivery')).toBe('warn');
  });
  test('HC-51 신고가 있으면 🟠', () => {
    expect(levelOf(healthy({ reports_24h: 1 }), 'reports')).toBe('warn');
  });
  test('HC-54 메일 도메인과 학교가 다른 계정이 1개라도 생기면 🔴 (보안 수정 1 방어 장치)', () => {
    expect(levelOf(healthy(), 'identity-mismatch')).toBe('ok');
    expect(levelOf(healthy({ identity_mismatch: 1 }), 'identity-mismatch')).toBe('critical');
  });
  test('HC-55 manaba 통지 설정 단계: 10/29 대비 증감을 참고로 보여준다', () => {
    const r = runChecks(healthy({ manaba_setup_stages: { none: 5, pending: 6, no_push: 3, ready: 11 } }), { now: NOW })
      .results.find((x) => x.id === 'manaba-setup-funnel');
    expect(r.level).toBe('info');
    expect(r.message).toContain('미시작 5 (-2)');
    expect(r.message).toContain('정상 11 (+7)');
    expect(r.message).toContain('전체 25명');
  });
  test('HC-52 용량 400MB 🟠 / 475MB 🔴', () => {
    expect(levelOf(healthy({ db_size_mb: 410 }), 'db-size')).toBe('warn');
    expect(levelOf(healthy({ db_size_mb: 480 }), 'db-size')).toBe('critical');
  });
  test('HC-53 만료 20일 전 🟠, 5일 전 🔴, 지나면 끝낼 때까지 🔴', () => {
    expect(levelOf(healthy(), 'deadlines', new Date('2027-01-12T09:00:00+09:00'))).toBe('warn');
    expect(levelOf(healthy(), 'deadlines', new Date('2027-01-27T09:00:00+09:00'))).toBe('critical');
    const past = runChecks(healthy(), { now: new Date('2027-02-03T09:00:00+09:00') }).results.find((r) => r.id === 'deadlines');
    expect(past).toMatchObject({ level: 'critical' });
    expect(past.message).toContain('2일 지남!');
    expect(levelOf(healthy(), 'deadlines', NOW)).toBe('ok');
  });
});

describe('알림 문구', () => {
  test('HC-60 🔴 가 없으면 폰 푸시를 보내지 않는다', () => {
    expect(buildPushMessage(runChecks(healthy({ reports_24h: 2 }), { now: NOW }).results)).toBeNull();
  });
  test('HC-61 🔴 가 있으면 건수와 항목을 푸시한다', () => {
    const msg = buildPushMessage(runChecks(healthy({ last_notice_at: hoursAgo(100) }), { now: NOW }).results);
    expect(msg.title).toBe('🔴 UniOne 이상 감지 1건');
    expect(msg.body).toContain('manaba 공지 수신');
  });
  test('HC-62 메일 제목: 정상이면 ✅, 이상이면 건수 + 일본식 날짜', () => {
    expect(buildEmail(runChecks(healthy(), { now: NOW }).results, NOW).subject)
      .toBe('[UniOne 건강검진] ✅ 이상 없음 (2026年10月29日)');
    const bad = runChecks(healthy({ last_notice_at: hoursAgo(100), reports_24h: 1 }), { now: NOW }).results;
    expect(buildEmail(bad, NOW).subject).toBe('[UniOne 건강검진] 🔴 1건 · 🟠 1건 (2026年10月29日)');
  });
  test('HC-63 메일 본문은 🔴 가 맨 위', () => {
    const bad = runChecks(healthy({ reports_24h: 1, db_size_mb: 480 }), { now: NOW }).results;
    const lines = buildEmail(bad, NOW).text.split('\n');
    expect(lines[2]).toMatch(/^🔴 데이터베이스 용량/);
  });
});

describe('날짜 도우미', () => {
  test('HC-70 학기 판정과 JST 날짜', () => {
    expect(isSemester(new Date('2026-10-29T00:00:00Z'))).toBe(true);
    expect(isSemester(new Date('2026-08-31T16:00:00Z'))).toBe(false); // JST 9/1
    expect(formatJstDate(new Date('2026-10-28T15:30:00Z'))).toBe('2026年10月29日');
  });
});
