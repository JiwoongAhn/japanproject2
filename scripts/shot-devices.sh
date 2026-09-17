#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/shot-devices.sh — 릴리스 전 "눈 검사": iOS 시뮬레이터 4대 스크린샷 대조 시트
#
# 자동 넘침 검사(npm run e2e:layout)는 "글자가 겹쳤다/잘렸다"는 잡지만
# "목업이 우표만큼 작아졌다" 같은 미감은 못 잡는다. 릴리스 직전 이 스크립트로
# 기기별 스크린샷을 한 HTML 에 나란히 놓고 사람이 6분만 훑는다.
#
# 사용법:
#   scripts/shot-devices.sh              # 빌드 + 4대 스크린샷 + HTML 갤러리
#   scripts/shot-devices.sh --no-build   # 이미 만든 .app 재사용 (빠름)
#   scripts/shot-devices.sh --debug      # Debug 빌드(Metro 연결)로 촬영 — ⚠️ Release 빌드는
#                                        #   테스트용 딥링크 로그인이 동작하지 않아(원인 미상, 실사용자는 OTP라 무관)
#                                        #   온보딩 순회는 --debug 로 해야 한다. Metro 는 스크립트가 띄운다.
#
# 동작:
#   1) ios/ 없으면 expo prebuild, Pods 없으면 pod install, 시뮬레이터용 Release .app 빌드(1회)
#   2) UniOne-SE3 / UniOne-12 / UniOne-13mini / UniOne-17PM 시뮬레이터 생성(최초 1회)·부팅·설치
#   3) Maestro 가 있으면 .maestro/shots_onboarding.yaml 로 온보딩까지 순회하며 촬영
#      Maestro 가 없으면 ⚠️ 첫 화면 1장만 촬영(열화 모드) — 의존성 때문에 전체가 멈추지 않게
#   4) shots/<시각>/index.html 갤러리 생성 (기기=열, 화면=행)
#
# Maestro 설치(무료): curl -Ls "https://get.maestro.mobile.dev" | bash
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SCHEME="UniOne"
APP_ID="com.jiwoongahn.unione"
DERIVED="$ROOT/ios/build"
APP_PATH="$DERIVED/Build/Products/Release-iphonesimulator/$SCHEME.app"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$ROOT/shots/$STAMP"
NO_BUILD=0
DEBUG_MODE=0
for arg in "$@"; do
  [[ "$arg" == "--no-build" ]] && NO_BUILD=1
  [[ "$arg" == "--debug" ]] && DEBUG_MODE=1
done
if [[ $DEBUG_MODE -eq 1 ]]; then
  CONFIGURATION="Debug"
  APP_PATH="$DERIVED/Build/Products/Debug-iphonesimulator/$SCHEME.app"
else
  CONFIGURATION="Release"
fi

# 이름|기기 종류 (xcrun simctl list devicetypes 의 표시 이름)
DEVICES=(
  "UniOne-SE3|iPhone SE (3rd generation)"
  "UniOne-12|iPhone 12"
  "UniOne-13mini|iPhone 13 mini"
  "UniOne-17PM|iPhone 17 Pro Max"
)

log()  { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$*"; }

# ── 1) 빌드 ─────────────────────────────────────────────────────────────────
if [[ $NO_BUILD -eq 1 && -d "$APP_PATH" ]]; then
  log "빌드 건너뜀 (--no-build): $APP_PATH"
else
  if [[ ! -d ios ]]; then
    log "ios/ 가 없어 expo prebuild 실행"
    npx expo prebuild --platform ios --no-install
  fi
  if [[ ! -d "ios/$SCHEME.xcworkspace" ]]; then
    log "Pods 설치 (최초 1회, 수 분 소요)"
    (cd ios && pod install)
  fi
  log "시뮬레이터용 $CONFIGURATION 빌드 (Release=JS 번들 포함 → Metro 불필요)"
  # ⚠️ Xcode 의 JS 번들 단계는 .env 를 못 읽어 EXPO_PUBLIC_* 가 빠진 번들이 만들어진다
  #    (→ Supabase URL 없음 → 로그인이 조용히 실패). 셸 환경으로 내보내 상속시킨다.
  if [[ -f .env ]]; then set -a; source .env; set +a; fi
  xcodebuild \
    -workspace "ios/$SCHEME.xcworkspace" \
    -scheme "$SCHEME" \
    -configuration "$CONFIGURATION" \
    -sdk iphonesimulator \
    -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath "$DERIVED" \
    CODE_SIGNING_ALLOWED=NO \
    build | grep -E "error:|warning: .*deprecated|BUILD (SUCCEEDED|FAILED)" || true
  [[ -d "$APP_PATH" ]] || { echo "❌ 빌드 산출물이 없습니다: $APP_PATH"; exit 1; }
fi

# ── 1b) Debug 모드: Metro 가 없으면 띄운다 (앱이 localhost:8081 에서 JS 를 받는다) ──
METRO_PID=""
if [[ $DEBUG_MODE -eq 1 ]]; then
  if ! curl -s -o /dev/null "http://localhost:8081/status"; then
    log "Metro 기동 (Debug 앱용)"
    npx expo start --port 8081 > "$ROOT/shots/metro-$STAMP.log" 2>&1 &
    METRO_PID=$!
    for _ in $(seq 1 60); do curl -s -o /dev/null "http://localhost:8081/status" && break; sleep 2; done
  fi
  trap '[[ -n "$METRO_PID" ]] && kill "$METRO_PID" 2>/dev/null || true' EXIT
fi

# ── 2) 온보딩 진입용 딥링크 (Maestro 있을 때만 필요) ──────────────────────────
HAVE_MAESTRO=0
if command -v maestro >/dev/null 2>&1 || [[ -x "$HOME/.maestro/bin/maestro" ]]; then
  HAVE_MAESTRO=1
  export PATH="$PATH:$HOME/.maestro/bin"
  # Maestro 는 Java 가 필요. 시스템 Java 가 없으면 Android Studio 내장 JDK 를 쓴다
  if ! /usr/libexec/java_home >/dev/null 2>&1; then
    AS_JBR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
    if [[ -x "$AS_JBR/bin/java" ]]; then
      export JAVA_HOME="$AS_JBR"; export PATH="$JAVA_HOME/bin:$PATH"
    else
      warn "Java 가 없어 Maestro 를 못 씁니다 (brew install openjdk@17) → 열화 모드"; HAVE_MAESTRO=0
    fi
  fi
fi
DEEP_LINK=""
if [[ $HAVE_MAESTRO -eq 1 ]]; then
  log "테스트 세션 발급 → 딥링크 (온보딩 화면 진입용)"
  DEEP_LINK="$(node -e '
    require("dotenv").config({ path: ".env" });
    const h = require("./e2e/helpers/supabaseHelper");
    (async () => {
      await h.updateTestProfile({ onboarding_completed: false });
      const s = await h.getTestSession();
      process.stdout.write(`unione://auth/callback#access_token=${s.access_token}&refresh_token=${s.refresh_token}&type=magiclink`);
    })().catch((e) => { console.error(e.message); process.exit(1); });
  ')" || { warn "세션 발급 실패 → 열화 모드(첫 화면만)"; HAVE_MAESTRO=0; }
else
  warn "Maestro 가 없어 첫 화면 1장만 촬영합니다. 설치: curl -Ls \"https://get.maestro.mobile.dev\" | bash"
fi

# ── 3) 기기별 촬영 ──────────────────────────────────────────────────────────
RUNTIME="$(xcrun simctl list runtimes | grep -E '^iOS' | tail -1 | sed -E 's/.*(com\.apple\.CoreSimulator\.SimRuntime\.[A-Za-z0-9.-]+).*/\1/')"
mkdir -p "$OUT"

for entry in "${DEVICES[@]}"; do
  NAME="${entry%%|*}"; TYPE_NAME="${entry##*|}"
  TYPE_ID="$(xcrun simctl list devicetypes | grep -F "$TYPE_NAME (" | sed -E 's/.*\((com\.apple[^)]+)\).*/\1/' | head -1 || true)"
  if [[ -z "$TYPE_ID" ]]; then warn "기기 종류 없음: $TYPE_NAME → 건너뜀"; continue; fi

  # grep 무일치(=아직 없음)는 정상이므로 set -e 로 죽지 않게 || true
  UDID="$(xcrun simctl list devices | grep -F "$NAME (" | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/' | head -1 || true)"
  if [[ -z "$UDID" ]]; then
    log "시뮬레이터 생성: $NAME ($TYPE_NAME)"
    UDID="$(xcrun simctl create "$NAME" "$TYPE_ID" "$RUNTIME")"
  fi

  log "$NAME 부팅·설치"
  xcrun simctl boot "$UDID" 2>/dev/null || true
  xcrun simctl bootstatus "$UDID" -b >/dev/null
  xcrun simctl terminate "$UDID" "$APP_ID" 2>/dev/null || true
  xcrun simctl uninstall "$UDID" "$APP_ID" 2>/dev/null || true
  xcrun simctl install "$UDID" "$APP_PATH"

  DEV_OUT="$OUT/$NAME"; mkdir -p "$DEV_OUT"
  if [[ $HAVE_MAESTRO -eq 1 ]]; then
    log "$NAME Maestro 순회 촬영"
    # perl alarm = 기기당 10분 상한 (플로우가 무한 루프에 빠져도 전체가 멈추지 않게)
    ( cd "$DEV_OUT" && perl -e 'alarm 600; exec @ARGV' maestro --device "$UDID" test \
        --debug-output "$DEV_OUT/.maestro" -e DEEP_LINK="$DEEP_LINK" "$ROOT/.maestro/shots_onboarding.yaml" ) \
      || warn "$NAME Maestro 플로우가 중간에 실패 (찍힌 장까지 저장)"
    # 플로우가 실패하면 takeScreenshot 결과가 디버그 폴더로 가므로 끌어온다
    find "$DEV_OUT/.maestro" -path '*takeScreenshot*' -name '*.png' -exec cp {} "$DEV_OUT/" \; 2>/dev/null || true
  fi
  if [[ -z "$(ls "$DEV_OUT" 2>/dev/null)" ]]; then
    xcrun simctl launch "$UDID" "$APP_ID" >/dev/null
    sleep $(( DEBUG_MODE == 1 ? 25 : 6 ))
    xcrun simctl io "$UDID" screenshot "$DEV_OUT/01_first.png" >/dev/null
  fi
  xcrun simctl shutdown "$UDID" 2>/dev/null || true
done

# ── 4) HTML 갤러리 ──────────────────────────────────────────────────────────
log "갤러리 생성"
python3 - "$OUT" <<'PY'
import os, sys, html
out = sys.argv[1]
devs = sorted(d for d in os.listdir(out) if os.path.isdir(os.path.join(out, d)))
screens = sorted({f for d in devs for f in os.listdir(os.path.join(out, d)) if f.endswith('.png')})
rows = []
for s in screens:
    cells = ''.join(
        f'<td><img src="{d}/{s}" alt="{html.escape(d)} {html.escape(s)}"></td>' if os.path.exists(os.path.join(out, d, s)) else '<td class="na">—</td>'
        for d in devs)
    rows.append(f'<tr><th>{html.escape(s)}</th>{cells}</tr>')
head = ''.join(f'<th>{html.escape(d)}</th>' for d in devs)
page = f'''<!doctype html><meta charset="utf-8"><title>UniOne 기기별 스크린샷 {html.escape(os.path.basename(out))}</title>
<style>body{{font-family:-apple-system,sans-serif;margin:16px;background:#f2f4f6}}table{{border-collapse:separate;border-spacing:8px}}
th{{font-weight:600;font-size:13px;color:#333}}td{{vertical-align:top;background:#fff;border-radius:8px;padding:4px}}
img{{width:240px;height:auto;display:block;border-radius:6px}}td.na{{color:#aaa;text-align:center;width:240px}}</style>
<h2>UniOne 기기별 스크린샷 — {html.escape(os.path.basename(out))}</h2>
<p>기기=열, 화면=행. 체크: 목업 크기 적당한가 / 제목·버튼이 겹치지 않는가 / 요약 페이지가 다 보이는가</p>
<table><tr><th></th>{head}</tr>{''.join(rows)}</table>'''
open(os.path.join(out, 'index.html'), 'w').write(page)
print(f'  {len(devs)}대 × {len(screens)}화면 → {out}/index.html')
PY
open "$OUT/index.html" 2>/dev/null || true
