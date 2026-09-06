#!/usr/bin/env bash
# 학교별 URL 생존 검사
# ─────────────────────────────────────────────────────────────
# src/constants/universityLinks.js에 등록된 모든 URL에 1회씩 요청을 보내
# 살아있는지(2xx/3xx) 확인한다. 학교 시스템은 예고 없이 주소가 바뀌므로
# 정기적으로 돌려 죽은 링크를 찾아낸다.
#
# 사용법:
#   bash scripts/check-links.sh          # 전체 검사
#   bash scripts/check-links.sh --dead   # 죽은 것만 출력
#
# ⚠️ 학교 서버에 부담을 주지 않도록 각 URL에 1회만, 요청 사이에 간격을 둔다.
#    (CLAUDE.md "학교 서버 과부하 방지" 원칙)

set -uo pipefail
cd "$(dirname "$0")/.."

DEAD_ONLY=false
[ "${1:-}" = "--dead" ] && DEAD_ONLY=true

DELAY=0.4          # 요청 사이 간격(초)
TIMEOUT=10         # 응답 대기 한도(초)
UA="Mozilla/5.0 (compatible; UniOne-linkcheck/1.0; +https://unipas.app)"

# universityLinks.js에서 "학교id|항목명|URL" 목록을 추출
URLS=$(node -e "
const L = require('./src/constants/universityLinks.js');
const obj = L.universityLinks || L.default || L;
for (const [id, v] of Object.entries(obj)) {
  for (const [key, url] of Object.entries(v)) {
    if (typeof url === 'string' && url.startsWith('http')) console.log(id + '|' + key + '|' + url);
  }
}
")

total=0; dead=0
printf "%-5s %-14s %-14s %s\n" "코드" "학교" "항목" "URL"
printf '%.0s─' {1..100}; echo

while IFS='|' read -r id key url; do
  [ -z "$url" ] && continue
  total=$((total + 1))
  code=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time "$TIMEOUT" -A "$UA" "$url" 2>/dev/null)
  # 000 = 연결 실패(도메인 없음/타임아웃), 4xx·5xx = 서버가 거부
  if [ "$code" = "000" ] || [ "${code:0:1}" = "4" ] || [ "${code:0:1}" = "5" ]; then
    dead=$((dead + 1))
    printf "%-5s %-14s %-14s %s\n" "$code" "$id" "$key" "$url"
  elif [ "$DEAD_ONLY" = false ]; then
    printf "%-5s %-14s %-14s %s\n" "$code" "$id" "$key" "$url"
  fi
  sleep "$DELAY"
done <<< "$URLS"

printf '%.0s─' {1..100}; echo
echo "총 ${total}개 중 문제 ${dead}개"
echo ""
echo "※ 000 = 도메인 없음 또는 응답 없음 / 403 = 봇 차단일 수 있어 브라우저로 재확인 필요"
[ "$dead" -gt 0 ] && exit 1
exit 0
