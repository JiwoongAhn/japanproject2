// 발송 직후 확인 — 폰이 받는 것과 똑같은 파일을 서버에서 내려받아 검사한다 (scripts/ota.sh 가 부른다)
//   인자 = eas update 출력 로그 (지문 = Runtime version 과 update ID 를 읽는다)
const fs = require('fs');
const { inspect } = require('./check-ota-bundle.cjs');

const URL_ = require('../../app.json').expo.updates.url;
const log = fs.readFileSync(process.argv[2], 'utf8');

async function live(platform, runtime) {
  const res = await fetch(URL_, {
    headers: {
      'expo-platform': platform, 'expo-runtime-version': runtime, 'expo-channel-name': 'production',
      'expo-protocol-version': '1', 'expo-api-version': '1', accept: 'multipart/mixed',
    },
  });
  const parts = (await res.text()).split(/\r?\n/).filter((l) => l.startsWith('{')).map((l) => JSON.parse(l));
  const manifest = parts.find((x) => x.launchAsset);
  if (!manifest) throw new Error(`매니페스트 없음 (HTTP ${res.status})`);
  const auth = parts.find((x) => x.assetRequestHeaders)?.assetRequestHeaders ?? {};
  const asset = await fetch(manifest.launchAsset.url, { headers: auth[manifest.launchAsset.key] ?? {} });
  if (!asset.ok) throw new Error(`번들 내려받기 실패 (HTTP ${asset.status})`);
  return { id: manifest.id, buf: Buffer.from(await asset.arrayBuffer()) };
}

(async () => {
  let bad = false;
  const targets = [...log.matchAll(/Runtime version\s+(\S+)[\s\S]*?(iOS|Android) update ID\s+(\S+)/g)];
  if (targets.length !== 2) { console.log('❌ 발송 로그에서 iOS·Android 를 모두 찾지 못함'); process.exit(1); }
  for (const [, runtime, label, id] of targets) {
    const platform = label.toLowerCase();
    try {
      const got = await live(platform, runtime);
      const problems = inspect(got.buf);
      if (got.id !== id) problems.push(`방금 보낸 업데이트가 아님 (${got.id})`);
      console.log(problems.length ? `❌ ${platform}: ${problems.join(' / ')}` : `✅ ${platform} ${id}`);
      if (problems.length) bad = true;
    } catch (e) {
      console.log(`❌ ${platform}: ${e.message}`); bad = true;
    }
  }
  process.exit(bad ? 1 : 0);
})();
