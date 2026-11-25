#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/ota.sh — 앱 업데이트(OTA)를 안전하게 보내기
#
# 사용법:
#   scripts/ota.sh --check                # 만들고 검사만 (발송 안 함)
#   scripts/ota.sh "업데이트 문구(일본어)"   # 검사를 전부 통과하면 발송
#
# 하나라도 이상하면 보내지 않고 멈춘다:
#   ① 커밋 안 한 파일  ② 앱 지문이 스토어 빌드와 다름(폰에 도착 안 함)
#   ③ 번들에 서버 주소·공개 열쇠가 없음(앱이 안 켜짐)  ④ 비밀값이 번들에 섞임
# 보낸 뒤에는 서버에 올라간 파일을 내려받아 ③을 한 번 더 확인한다.
#
# 만든 계기(2026-11-25): 서버 주소가 빠진 업데이트가 1~2분 배포된 사고.
#   (package.json 의 scripts 에 넣지 말 것 — 앱 지문이 바뀌어 업데이트가 폰에 도착하지 않는다)
#   `eas update --environment` 가 .env 를 안 읽었고, 잘못된 결과가 Metro 캐시에 남았다 → --clear 로 매번 새로 만든다
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."

CHECK_ONLY=0; MESSAGE="${1:-}"
[[ "$MESSAGE" == "--check" ]] && CHECK_ONLY=1
[[ -n "$MESSAGE" ]] || { echo "사용법: scripts/ota.sh --check  또는  scripts/ota.sh \"문구\""; exit 1; }

log()  { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
stop() { printf '\n\033[1;31m❌ 발송 중단: %s\033[0m\n' "$*"; exit 1; }

# ── ① 커밋 확인 ──
if [[ $CHECK_ONLY -eq 0 && -n "$(git status --porcelain)" ]]; then
  git status --short; stop "커밋하지 않은 파일이 있습니다"
fi

# 로컬 ios/·android/ 가 있으면 지문이 달라진다 → 잠깐 치우고, 어떻게 끝나든 되돌린다
BAK="$(mktemp -d)"
restore() { for d in ios android; do if [[ -d "$BAK/$d" ]]; then mv "$BAK/$d" "./$d"; fi; done; rmdir "$BAK" 2>/dev/null || true; }
trap restore EXIT
for d in ios android; do if [[ -d "$d" ]]; then mv "$d" "$BAK/$d"; fi; done

# ── ② 지문 ──
log "앱 지문이 스토어 빌드와 같은지 확인"
for p in ios android; do
  BUILD_ID="$(npx eas build:list --platform "$p" --channel production --status finished --limit 1 --json --non-interactive 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s)[0]?.id??""))')"
  [[ -n "$BUILD_ID" ]] || stop "$p 최근 빌드를 찾지 못했습니다"
  OUT="$(npx eas fingerprint:compare --build-id "$BUILD_ID" --non-interactive 2>&1 || true)"
  grep -q "✅.*matches" <<<"$OUT" || { tail -5 <<<"$OUT"; stop "$p 지문이 다릅니다 (새 빌드가 필요한 변경)"; }
  echo "✅ $p"
done

# ── ③④ 새로 만들고 검사 ──
log "캐시를 지우고 번들 만들기 (1~2분)"
LOG="$BAK.log"
npx expo export --clear --platform all --output-dir dist --dump-assetmap --source-maps >"$LOG" 2>&1 || { tail -20 "$LOG"; stop "번들 만들기 실패"; }
log "번들 검사 (서버 주소·공개 열쇠·비밀값)"
node scripts/lib/check-ota-bundle.cjs dist || stop "번들 검사 실패"

if [[ $CHECK_ONLY -eq 1 ]]; then log "검사 통과 (--check 라서 발송하지 않았습니다)"; exit 0; fi

# ── 발송 ── (--environment 는 절대 붙이지 않는다)
log "발송"
npx eas update --channel production --skip-bundler --input-dir dist --message "$MESSAGE" --non-interactive >"$LOG" 2>&1 || { tail -20 "$LOG"; stop "발송 실패"; }
grep -E "Runtime version|update ID|group ID" "$LOG"

log "서버에 올라간 파일을 내려받아 다시 확인"
if ! node scripts/lib/check-ota-live.cjs "$LOG"; then
  echo "🔴 올라간 업데이트가 이상합니다. 바로 되돌리세요:"
  echo "   npx eas update:list --branch production   → 직전 정상 그룹 id 확인"
  echo "   npx eas update:republish --group <id> --destination-channel production   (iOS·Android 각각)"
  exit 1
fi
log "완료 🎉"
