// 시간표 관련 순수 함수
// 테스트 대상: timetable.test.js

// 국사관대학 교시별 시작·종료 시간 (자정 기준 분수)
export const PERIOD_RANGES = {
  1: { start: 9 * 60,       end: 10 * 60 + 30  }, // 9:00 ~ 10:30
  2: { start: 10 * 60 + 45, end: 12 * 60 + 15  }, // 10:45 ~ 12:15
  3: { start: 12 * 60 + 55, end: 14 * 60 + 25  }, // 12:55 ~ 14:25
  4: { start: 14 * 60 + 40, end: 16 * 60 + 10  }, // 14:40 ~ 16:10
  5: { start: 16 * 60 + 25, end: 17 * 60 + 55  }, // 16:25 ~ 17:55
  6: { start: 18 * 60 + 10, end: 19 * 60 + 40  }, // 18:10 ~ 19:40
  7: { start: 19 * 60 + 55, end: 21 * 60 + 25  }, // 19:55 ~ 21:25
  8: { start: 21 * 60 + 40, end: 23 * 60 + 10  }, // 21:40 ~ 23:10
};

// 수업 목록에서 공강(빈 교시) 목록 계산
// courses: [{ day_of_week: 0~4, period: 1~8 }, ...]
// 반환값: [{ day: 0~4, period: 1~8 }, ...]
export function calculateFreePeriods(courses) {
  const occupied = new Set(courses.map(c => `${c.day_of_week}-${c.period}`));
  const free = [];
  for (let day = 0; day <= 4; day++) {
    for (let period = 1; period <= 8; period++) {
      if (!occupied.has(`${day}-${period}`)) {
        free.push({ day, period });
      }
    }
  }
  return free;
}

// 현재 시각(분)을 기준으로 수업 상태 반환
// period: 교시 번호 (1~8)
// nowMin: 자정 기준 현재 분수 (예: 9시30분 = 570)
// todayCoursesSorted: 오늘 수업 목록 (period 오름차순 정렬)
// 반환값: '進行中' | '次の授業' | '終了' | '未開始'
export function getCourseStatus(period, nowMin, todayCoursesSorted) {
  const range = PERIOD_RANGES[period];
  if (!range) return '未開始';

  if (nowMin >= range.start && nowMin < range.end) return '進行中';
  if (nowMin >= range.end) return '終了';

  // 아직 시작 전 — 오늘 수업 중 다음 교시인지 판단
  const sortedPeriods = todayCoursesSorted.map(c => c.period);
  const futureIdx = sortedPeriods.filter(p => PERIOD_RANGES[p]?.start > nowMin);
  if (futureIdx.length > 0 && futureIdx[0] === period) return '次の授業';
  return '未開始';
}
