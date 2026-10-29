// 건강검진 점검 목록 — health-check 함수가 매일 JST 09:00 (pg_cron health-check-daily) 에 실행한다.
//   숫자(snapshot)는 DB 함수 health_snapshot() 이 만들고, 여기서는 "정상/이상" 판정과 알림 문구만 한다.
//   앱(Jest)과 서버(Deno) 공용 순수 JS. 테스트: __tests__/utils/healthChecks.test.js
//
// 등급
//   critical 🔴 : 지금 사용자가 피해를 보는 중 → 개발자 폰으로 즉시 푸시 + 요약 메일
//   warn     🟠 : 곧 문제가 되거나 사람이 확인해야 함 → 요약 메일
//   info     ℹ️ : 참고용 숫자 → 요약 메일
//   ok       ✅ : 정상
//
// ▶ 새 점검 추가하는 법 (점검 목록에 없던 고장을 겪으면 하나씩 늘린다)
//   1. 아래 CHECKS 배열 끝에 { id, title, since, why, run } 블록 하나를 추가한다
//      since = 추가한 날짜와 계기(어떤 고장 때문에 생겼는지)
//   2. 판정에 필요한 숫자가 snapshot 에 없으면 health_snapshot() 에 칸을 추가하는 새 마이그레이션을 만든다
//   3. __tests__/utils/healthChecks.test.js 에 「그 고장 상황 → 경고가 나온다」 테스트를 하나 추가한다

const JST_MS = 9 * 3600 * 1000;
const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const LEVEL_ORDER = { ok: 0, info: 1, warn: 2, critical: 3 };
export const LEVEL_ICON = { ok: '✅', info: 'ℹ️', warn: '🟠', critical: '🔴' };

// 자동 작업별 「마지막 성공 후 이 시간(시간)이 지나면 이상」
export const EXPECTED_CRON_JOBS = {
  'expo-receipt-poller-15min': 1,
  'push-retry-worker-hourly': 3,
  'push-cleanup-daily': 26,
  'deadline-reminder-daily': 26,
};

// 만료·기한 (30일 전부터 🟠, 7일 전부터 🔴, 지나면 🔴 계속) — 처리를 끝낸 항목은 지운다
export const DEADLINES = [
  { date: '2027-02-01', what: 'Google Play 난독화 경고 대응 (expo-build-properties)' },
  { date: '2027-05-04', what: 'unipas.app 도메인 갱신(Namecheap) — 끊기면 로그인 코드 메일·통지 전부 중단' },
  { date: '2027-06-27', what: 'iOS 배포 인증서 만료 — 다음 빌드 전 확인' },
  { date: '2027-10-29', what: 'GitHub 토큰 unione-ops-bot 갱신' },
  { date: '2028-08-18', what: 'Anthropic API 키 교체 (Supabase 시크릿 ANTHROPIC_API_KEY)' },
];

function jstMonth(now) {
  return new Date(now.getTime() + JST_MS).getUTCMonth() + 1;
}

// 수업 기간(대략): 4~7월, 10~1월. 2·3·8·9월은 방학이라 공지가 적다
export function isSemester(now) {
  return ![2, 3, 8, 9].includes(jstMonth(now));
}

export function formatJstDate(d) {
  const j = new Date(d.getTime() + JST_MS);
  const mm = String(j.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(j.getUTCDate()).padStart(2, '0');
  return `${j.getUTCFullYear()}年${mm}月${dd}日`;
}

function hoursSince(iso, now) {
  if (!iso) return Infinity;
  return (now.getTime() - new Date(iso).getTime()) / HOUR_MS;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const ok = (message = '정상') => ({ level: 'ok', message });

export const CHECKS = [
  {
    id: 'manaba-inbound',
    title: 'manaba 공지 수신',
    since: '2026-10-29 초기 목록 — 학교가 메일 형식·발신 주소를 바꾸면 오류 없이 조용히 멈춘다',
    run(snap, { now }) {
      if (num(snap.verified_subscriptions) === 0) return ok('수신 설정한 학생 없음');
      const h = hoursSince(snap.last_notice_at, now);
      const shown = Number.isFinite(h) ? `${Math.floor(h)}시간` : '기록 없음';
      if (isSemester(now)) {
        if (h > 72) return { level: 'critical', message: `학기 중인데 마지막 공지 수신 후 ${shown} 지남 — Cloudflare 워커·mail-inbound·발신 도메인 확인` };
        if (h > 48) return { level: 'warn', message: `마지막 공지 수신 후 ${shown} 지남 (주말이면 정상일 수 있음)` };
      } else if (h > 24 * 10) {
        return { level: 'warn', message: `방학 중이지만 마지막 공지 수신 후 ${shown} 지남` };
      }
      return ok(`최근 24시간 ${num(snap.notices_24h)}건 수신`);
    },
  },
  {
    id: 'push-token-missing',
    title: '알림을 못 받는 학생',
    since: '2026-10-29 건강검진을 만들다 발견 — 수신 설정 10명 중 6명이 폰 알림 주소 0개',
    run(snap) {
      const total = num(snap.verified_subscriptions);
      const missing = num(snap.subs_without_push_token);
      if (missing === 0) return ok();
      const msg = `수신 설정을 마친 ${total}명 중 ${missing}명이 폰 알림 주소가 없어 알림을 못 받음`;
      if (total >= 3 && missing / total >= 0.5) return { level: 'warn', message: msg };
      return { level: 'info', message: msg };
    },
  },
  {
    id: 'ai-summary',
    title: 'AI 요약',
    since: '2026-10-29 초기 목록 — API 키 만료·요금 한도면 요약만 조용히 빠진다',
    run(snap) {
      const n = num(snap.ai_push_notices_24h);
      const missing = num(snap.ai_push_missing_24h);
      if (n === 0) return ok('최근 24시간 대상 공지 없음');
      if (n >= 3 && missing / n >= 0.5) {
        return { level: 'critical', message: `요약 실패 ${missing}/${n}건 — ANTHROPIC_API_KEY·Anthropic 요금 한도·mail-inbound 로그 확인` };
      }
      if (missing > 0) return { level: 'info', message: `요약 실패 ${missing}/${n}건 (일시적일 수 있음)` };
      return ok(`${n}건 모두 요약됨`);
    },
  },
  {
    id: 'cron-jobs',
    title: '자동 작업(pg_cron)',
    since: '2026-10-29 초기 목록 — 자동 작업이 멈추면 마감 알림·푸시 재시도가 사라진다',
    run(snap, { now }) {
      const jobs = snap.cron_jobs ?? {};
      const problems = [];
      let critical = false;
      for (const [name, maxHours] of Object.entries(EXPECTED_CRON_JOBS)) {
        const job = jobs[name];
        if (!job) { problems.push(`${name} 작업이 없음`); critical = true; continue; }
        if (num(job.failures_24h) > 0) { problems.push(`${name} 24시간 실패 ${job.failures_24h}회`); critical = true; }
        const h = hoursSince(job.last_success, now);
        if (h > maxHours) { problems.push(`${name} 마지막 성공 후 ${Number.isFinite(h) ? Math.floor(h) + '시간' : '기록 없음'}`); critical = true; }
      }
      if (num(snap.http_errors_recent) > 0) problems.push(`자동 작업이 부른 서버 함수 실패 응답 ${snap.http_errors_recent}건`);
      if (problems.length === 0) return ok(`${Object.keys(EXPECTED_CRON_JOBS).length}개 정상`);
      return { level: critical ? 'critical' : 'warn', message: problems.join(' / ') };
    },
  },
  {
    id: 'push-delivery',
    title: '푸시 발송',
    since: '2026-10-29 초기 목록 — Expo·인증서 문제면 푸시가 실패로 쌓인다',
    run(snap) {
      const byStatus = snap.push_24h ?? {};
      const total = Object.values(byStatus).reduce((s, v) => s + num(v), 0);
      const bad = num(byStatus.dead) + num(byStatus.permanent_fail);
      const stuck = num(snap.push_retry_stuck);
      const problems = [];
      if (total >= 5 && bad / total >= 0.2) problems.push(`최근 24시간 실패 ${bad}/${total}건`);
      if (stuck >= 5) problems.push(`6시간 넘게 재시도 대기 ${stuck}건`);
      if (problems.length) return { level: 'warn', message: problems.join(' / ') };
      return ok(`최근 24시간 ${total}건, 실패 ${bad}건`);
    },
  },
  {
    id: 'reports',
    title: '게시판 신고',
    since: '2026-10-29 초기 목록 — 신고는 빨리 확인해야 한다(스토어 심사 요건)',
    run(snap) {
      const n = num(snap.reports_24h);
      if (n === 0) return ok('신고 없음');
      return { level: 'warn', message: `최근 24시간 신고 ${n}건 — 내용 확인 필요 (3건이면 자동 숨김)` };
    },
  },
  {
    id: 'db-size',
    title: '데이터베이스 용량',
    since: '2026-10-29 초기 목록 — 무료 요금제 한도 500MB',
    run(snap) {
      const mb = num(snap.db_size_mb);
      if (mb >= 475) return { level: 'critical', message: `${mb}MB / 500MB — 곧 쓰기가 막힘` };
      if (mb >= 400) return { level: 'warn', message: `${mb}MB / 500MB — 정리 또는 요금제 검토` };
      return ok(`${mb}MB / 500MB`);
    },
  },
  {
    id: 'deadlines',
    title: '만료일',
    since: '2026-10-29 초기 목록 — 도메인 정지 전례(2026-05)',
    run(_snap, { now }) {
      const soon = DEADLINES
        .map((d) => ({ ...d, days: Math.ceil((new Date(`${d.date}T00:00:00+09:00`).getTime() - now.getTime()) / DAY_MS) }))
        .filter((d) => d.days <= 30)
        .sort((a, b) => a.days - b.days);
      if (soon.length === 0) return ok('30일 안에 만료 없음');
      const message = soon.map((d) => (d.days < 0 ? `${d.what} (${-d.days}일 지남!)` : `${d.what} (D-${d.days})`)).join(' / ');
      return { level: soon.some((d) => d.days <= 7) ? 'critical' : 'warn', message };
    },
  },
  {
    id: 'identity-mismatch',
    title: '학교 판정 방어 장치',
    since: '2026-10-29 보안 수정 1 — 학생이 프로필의 학교를 바꿔 다른 학교 게시판·메일을 볼 수 있었다',
    run(snap) {
      if (snap.identity_mismatch == null) return ok('확인 불가 (snapshot 에 칸 없음)');
      const n = num(snap.identity_mismatch);
      if (n === 0) return ok('모든 계정의 학교가 메일 도메인과 일치');
      return {
        level: 'critical',
        message: `메일 도메인과 학교가 다른 계정 ${n}개 — 다른 학교 열람 방어가 깨졌을 수 있음 (guard_profile_identity 트리거 확인)`,
      };
    },
  },
  {
    id: 'activity',
    title: '어제 하루 활동',
    since: '2026-10-29 초기 목록 — 참고용',
    run(snap) {
      return {
        level: 'info',
        message: `가입 ${num(snap.signups_24h)} · 글 ${num(snap.posts_24h)} · 공지 ${num(snap.notices_24h)} · 신고 ${num(snap.reports_24h)}`,
      };
    },
  },
];

// 전체 실행 — 점검 하나가 예외를 던져도 나머지는 계속한다 (예외 자체를 🔴 로 보고)
export function runChecks(snap, { now = new Date(), checks = CHECKS } = {}) {
  const results = checks.map((c) => {
    try {
      const r = c.run(snap ?? {}, { now });
      return { id: c.id, title: c.title, level: r.level, message: r.message };
    } catch (e) {
      return { id: c.id, title: c.title, level: 'critical', message: `점검 코드 오류: ${e?.message ?? e}` };
    }
  });
  const worst = results.reduce((w, r) => (LEVEL_ORDER[r.level] > LEVEL_ORDER[w] ? r.level : w), 'ok');
  return { results, worst };
}

function countBy(results, level) {
  return results.filter((r) => r.level === level).length;
}

// 개발자 폰 푸시 — 🔴 가 있을 때만
export function buildPushMessage(results) {
  const crit = results.filter((r) => r.level === 'critical');
  if (crit.length === 0) return null;
  return {
    title: `🔴 UniOne 이상 감지 ${crit.length}건`,
    body: crit.map((r) => `${r.title}: ${r.message}`).join('\n').slice(0, 300),
  };
}

// 매일 요약 메일 — 이상이 없어도 보낸다 (메일이 안 오면 건강검진 자체가 멈춘 것)
export function buildEmail(results, now = new Date()) {
  const c = countBy(results, 'critical');
  const w = countBy(results, 'warn');
  const status = c + w === 0 ? '✅ 이상 없음' : [c && `🔴 ${c}건`, w && `🟠 ${w}건`].filter(Boolean).join(' · ');
  const sorted = [...results].sort((a, b) => LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level]);
  const lines = sorted.map((r) => `${LEVEL_ICON[r.level]} ${r.title} — ${r.message}`);
  return {
    subject: `[UniOne 건강검진] ${status} (${formatJstDate(now)})`,
    text: [
      `${formatJstDate(now)} 09:00 건강검진 결과`,
      '',
      ...lines,
      '',
      '점검 목록: supabase/functions/health-check/checks.js',
      '이상 항목은 Claude Code 에 이 메일을 붙여넣고 「조사해줘」 라고 하면 됩니다.',
    ].join('\n'),
  };
}
