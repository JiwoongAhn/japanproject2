// 학교별 기능 표 출력 / 문서 갱신
//   node scripts/school-features.mjs          → 터미널에 표 출력
//   node scripts/school-features.mjs --write  → docs/university-lms-profiles.md 의 마커 사이를 갱신
// 표를 만드는 로직은 src/utils/schoolFeatures.js (Jest 가 같은 함수로 문서 최신 여부를 검사한다)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { universities } from '../src/constants/universities.js';
import { universityLinks } from '../src/constants/universityLinks.js';
import { buildSchoolFeatureTable, replaceBetweenMarkers } from '../src/utils/schoolFeatures.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docPath = join(root, 'docs/university-lms-profiles.md');
const table = buildSchoolFeatureTable(universities, universityLinks);

if (!process.argv.includes('--write')) {
  console.log(table);
} else {
  const next = replaceBetweenMarkers(readFileSync(docPath, 'utf8'), table);
  if (next === null) {
    console.error('❌ 문서에 school-features 마커가 없습니다:', docPath);
    process.exit(1);
  }
  writeFileSync(docPath, next);
  console.log('✅ 학교별 기능 표 갱신:', docPath);
}
