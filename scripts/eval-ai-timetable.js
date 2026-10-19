#!/usr/bin/env node
// AI 시간표 파서 정답 대조 (parse-timetable Edge Function 실호출)
//
// 사용법: node scripts/eval-ai-timetable.js <정답지.json> <이미지1> [이미지2 ...]
//   예) node scripts/eval-ai-timetable.js __tests__/fixtures/ai-timetable/nbu-2026-fall.expected.json \
//         __tests__/fixtures/ai-timetable/nbu-2026-fall.small.jpeg
//
// - E2E 테스트 계정(e2e/helpers/supabaseHelper.js 와 같은 계정)으로 로그인해 호출한다
// - 1회 호출 = 하루 10회 제한 중 1회 + API 비용 발생
// - 정답지·이미지는 실제 학생 데이터라 gitignore (__tests__/fixtures/ai-timetable/)
// - 비교: (요일·교시·학기) 칸 단위. 과목명은 공백·괄호·전각반각 차이를 무시하고 비교

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { normalizeAiCourses } = require('../src/utils/aiTimetable');

const SUPABASE_URL = 'https://rexnpusrxezuztxmkaex.supabase.co';
const TEST_USER_EMAIL = 'e2etest@kokushikan.ac.jp';
const TEST_USER_PASSWORD = 'Unipas-E2E-2024!';
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// 비교용 정규화 — 표기 차이(공백, 괄호, 로마숫자, 전각)는 오답으로 치지 않는다
function norm(s) {
  return String(s || '')
    .normalize('NFKC')
    .replace(/Ⅴ/g, 'V').replace(/Ⅵ/g, 'VI')
    .replace(/[\s　()（）<>＜＞「」,，・]/g, '')
    .toLowerCase();
}

async function main() {
  const [expectedPath, ...imagePaths] = process.argv.slice(2);
  if (!expectedPath || imagePaths.length === 0) {
    console.error('usage: node scripts/eval-ai-timetable.js <expected.json> <image...>');
    process.exit(1);
  }
  const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));

  const anon = createClient(SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  const { data: { session }, error } = await anon.auth.signInWithPassword({
    email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD,
  });
  if (error) throw new Error('로그인 실패: ' + error.message);

  const images = imagePaths.map((p) => ({
    mediaType: path.extname(p).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg',
    data: fs.readFileSync(p).toString('base64'),
  }));

  const started = Date.now();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/parse-timetable`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ images }),
  });
  const body = await res.json();
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (!res.ok) {
    console.error(`HTTP ${res.status}`, body);
    process.exit(1);
  }

  const { parsed } = normalizeAiCourses(body.courses);
  const key = (c) => `${c.term ?? 'unknown'}|${c.day}|${c.period}`;
  const got = new Map(parsed.map((c) => [`${c.term ?? 'unknown'}|${DAYS[c.day] ?? 'unknown'}|${c.period}`, c]));
  const fallbackTerm = expected.term;

  let slotOk = 0, nameOk = 0, profOk = 0, roomOk = 0, roomTotal = 0;
  const misses = [];
  for (const e of expected.courses) {
    const term = e.term ?? fallbackTerm;
    // 학기를 AI 가 unknown 으로 준 경우도 칸 일치로 인정 (미리보기에서 학기를 고르므로)
    const g = got.get(key({ ...e, term })) || got.get(key({ ...e, term: 'unknown' }));
    if (!g) { misses.push(`✗ 칸 없음   ${term} ${e.day}${e.period} ${e.name}`); continue; }
    slotOk++;
    const nOk = norm(g.name) === norm(e.name) || norm(g.name).includes(norm(e.name)) || norm(e.name).includes(norm(g.name));
    if (nOk) nameOk++; else misses.push(`✗ 과목명    ${e.day}${e.period} 정답「${e.name}」 AI「${g.name}」`);
    if (norm(g.professor) === norm(e.professor)) profOk++;
    else misses.push(`✗ 교수      ${e.day}${e.period} 정답「${e.professor}」 AI「${g.professor ?? ''}」`);
    if (e.room) {
      roomTotal++;
      if (norm(g.room) === norm(e.room)) roomOk++;
      else misses.push(`✗ 교실      ${e.day}${e.period} 정답「${e.room}」 AI「${g.room ?? ''}」`);
    }
  }
  const extra = parsed.length - slotOk;

  const n = expected.courses.length;
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  console.log(`\n[${path.basename(expectedPath)}] ${secs}s  tokens in=${body.usage?.input} out=${body.usage?.output}`);
  console.log(`칸(요일·교시·학기) ${slotOk}/${n} ${pct(slotOk, n)}`);
  console.log(`과목명             ${nameOk}/${n} ${pct(nameOk, n)}`);
  console.log(`교수               ${profOk}/${n} ${pct(profOk, n)}`);
  if (roomTotal) console.log(`교실               ${roomOk}/${roomTotal} ${pct(roomOk, roomTotal)}`);
  console.log(`정답에 없는 추가 항목 ${extra}개`);
  if (misses.length) console.log('\n' + misses.join('\n'));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
