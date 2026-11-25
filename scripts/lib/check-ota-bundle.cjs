// OTA 번들 검사 — scripts/ota.sh 가 부른다. 문제가 있으면 종료 코드 1
//   서버 주소와 공개 열쇠(anon)는 있어야 하고, .env 의 나머지 값(비밀)은 없어야 한다
const fs = require('fs');
const path = require('path');

const env = require('dotenv').parse(fs.readFileSync('.env'));
const PUBLIC = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];

// 번들(Buffer) 하나를 검사해 문제 목록을 돌려준다
function inspect(buf) {
  const problems = [];
  for (const key of PUBLIC) {
    if (!env[key]) problems.push(`.env 에 ${key} 가 없음`);
    else if (!buf.includes(env[key])) problems.push(`${key} 값이 번들에 없음 → 앱이 안 켜짐`);
  }
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('EXPO_PUBLIC_') && value.length >= 8 && buf.includes(value)) problems.push(`비밀값 ${key} 가 번들에 섞임`);
  }
  return problems;
}

if (require.main === module) {
  let bad = false;
  for (const p of ['ios', 'android']) {
    const dir = path.join(process.argv[2], '_expo/static/js', p);
    const file = fs.existsSync(dir) && fs.readdirSync(dir).find((f) => f.endsWith('.hbc'));
    const problems = file ? inspect(fs.readFileSync(path.join(dir, file))) : ['번들 파일이 없음'];
    console.log(problems.length ? `❌ ${p}: ${problems.join(' / ')}` : `✅ ${p}`);
    if (problems.length) bad = true;
  }
  process.exit(bad ? 1 : 0);
}

module.exports = { inspect };
