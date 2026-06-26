# Maestro 네이티브 E2E 테스트

진짜 안드로이드/iOS 앱을 에뮬레이터(또는 실기기)에서 실행해 화면을 눌러보는 E2E 테스트입니다.
**기존 `e2e/`(Playwright)는 "웹 화면"만 검증**하지만, 이 폴더는 **네이티브 앱**을 검증해서
"앱 켜자마자 죽음" 같은 실행 크래시를 잡아냅니다.

## 플로우 목록
| 파일 | 검증 내용 |
|------|-----------|
| `01_launch_smoke.yaml` | 앱이 켜지자마자 죽지 않고 첫 화면이 뜨는지 (**가장 중요**) |
| `02_consent_to_school.yaml` | 동의 화면 → 학교 선택 화면까지 진행되는지 |

---

## 0. 사전 준비 (한 번만)

### (1) Maestro 설치
```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```
설치 후 안내에 따라 PATH 추가가 필요할 수 있습니다(보통 `~/.zshrc`에 한 줄).
설치 확인:
```bash
maestro --version
```

### (2) 안드로이드 에뮬레이터 준비
Android Studio > Device Manager 에서 에뮬레이터를 하나 켜둡니다. 또는:
```bash
emulator -list-avds          # 사용 가능한 에뮬레이터 이름 보기
emulator -avd <이름>          # 에뮬레이터 실행
```

---

## 1. ⚠️ 가장 중요 — 어떤 앱을 설치해서 테스트할지

이번 크래시는 **EAS 빌드의 환경변수 누락** 때문이었습니다.
그래서 이 크래시를 제대로 재현/검증하려면 **production/preview로 빌드된 APK**를 깔아야 합니다.

- ❌ `expo start`로 띄운 **개발 클라이언트(Dev Build)**: JS를 메트로에서 받아오고 `.env`를
  로컬에서 읽기 때문에 이 크래시가 **재현되지 않습니다.** (통과해도 의미 약함)
- ✅ **preview/production APK**: `eas.json`의 `env`로 키가 번들에 박혀 들어가므로,
  실제 출시 빌드와 동일한 조건에서 검증됩니다.

preview APK 빌드(권장):
```bash
eas build --profile preview --platform android
```
빌드가 끝나면 나오는 `.apk`를 다운받아 에뮬레이터에 드래그&드롭하거나:
```bash
adb install ~/Downloads/빌드파일.apk
```

> 빠르게 "앱이 도는지"만 보고 싶으면 이미 설치된 앱으로 그냥 돌려도 됩니다.
> 다만 위 크래시류를 막는 안전망으로 쓰려면 preview APK 기준으로 돌리세요.

---

## 2. 테스트 실행

```bash
cd /Users/jiwoong/claudeproject/japanproject

# 폴더 전체 실행
maestro test .maestro/

# 특정 플로우만 실행
maestro test .maestro/01_launch_smoke.yaml

# 한 단계씩 눈으로 보며 디버깅(추천: 처음 셋업 시)
maestro studio
```

통과하면 각 단계에 ✅, 실패하면 어느 단계에서 멈췄는지 ❌로 표시됩니다.

---

## 3. iOS에서 돌리려면
iOS 시뮬레이터를 켜고 동일하게 `maestro test`를 실행하면 됩니다.
(appId가 iOS·Android 공통 `com.jiwoongahn.unione`이라 플로우 수정 불필요)
