# 🛠️ UniOne 유지보수 체크리스트

> 출시 전/후 운영을 위해 언제든 열어보는 체크리스트. (최종 갱신: 2026-07-21)

---

## A. 배포 수단 2가지 (먼저 이해할 것)

| 방식 | 언제 | 반영 속도 | 주의 |
|---|---|---|---|
| **OTA** (`eas update`) | JS/화면 코드만 바뀔 때 | 즉시(수분) | ⚠️ 사용자가 앱을 **완전 종료 후 재실행**해야 적용됨. 기기가 옛 빌드면 안 내려감 |
| **새 빌드** (`eas build`) | 네이티브·설정·라이브러리 변경, 또는 확실한 반영이 필요할 때 | 빌드 20~40분 + 심사 | runtime 버전이 맞아야 OTA도 호환 |

> 💡 "분명히 고쳤는데 폰에서 안 바뀜" = 십중팔구 OTA 미적용. 완전 종료 재실행 → 그래도면 새 빌드.

---

## B. 상시 모니터링 (주 1회 권장)

- [ ] **크래시/오류** — (권장: Sentry 도입) 실사용자 오류 실시간 수집. *현재 미도입 → 출시 전 추가 권장*
- [ ] **Supabase 로그** — Edge Function 오류 로그 확인 (`get_logs`)
- [ ] **Supabase Advisor** — 보안/성능 경고 확인 (`get_advisors`) — RLS 누락, 인덱스 등
- [ ] **DB 용량 / Storage** — post-images 버킷 용량, DB row 증가 추이
- [ ] **푸시 파이프라인** — 배치잡(receipt 폴링·재시도) dead 큐 쌓임 여부
- [ ] **스토어 리뷰 / support@unipas.app** — 사용자 문의·별점 확인

---

## C. ⚠️ 최대 리스크: 학교 사이트 파싱 (수시 확인)

manaba·kaede는 학교가 HTML을 바꾸면 **공지·시간표·교실 파싱이 조용히 깨진다.** 이 앱 유지보수의 1순위.

- [ ] **학기 시작 직후**(4월·10월) manaba 공지 파싱 정상 동작 확인
- [ ] **시스템 점검 공지** 후 kaede 학습나비 시간표·교실 파싱 재확인
- [ ] 깨졌을 때: `ManabaLoginScreen`(공지)·시간표 파싱 selector 수정 → OTA 배포
- [ ] 파싱 대상 selector 위치 메모: 공지 `.home-newsitem`, 시간표=학습나비 페이지

---

## D. 정기 관리 (분기 / 반기)

- [ ] **Expo SDK / 라이브러리** 보안 패치 업데이트 (반기)
- [ ] **인증서·프로비저닝 만료** 확인 (현재 iOS 배포 인증서 만료 2027-06-27)
- [ ] **도메인 갱신** — unipas.app (Cloudflare) 만료일 관리
- [ ] **Apple/Google 정책 변경** 대응 (개인정보·연령·UGC 등)
- [ ] **OTP/메일(Resend)** 발송 한도·도메인 인증(DKIM/SPF) 상태

---

## E. 데이터/보안 점검 (출시 전 필수)

- [ ] RLS 정책 전 테이블 적용 확인 (특히 posts/comments 차단 필터)
- [ ] 비밀번호·토큰 서버 미저장 원칙 유지 (kaede=기기 내 AES-256만)
- [ ] 탈퇴(delete-account) 시 데이터 완전 삭제 동작
- [ ] 데모 심사 계정(appreview@kokushikan.ac.jp) 로그인·데이터 상태

---

## F. 배포 직전 루틴 (릴리스마다)

1. [ ] `npx jest` 전체 통과
2. [ ] 변경분 실기 확인 (iOS **+ Android** 최소 각 1대)
3. [ ] 버전/빌드번호 확인 (`eas build`가 자동 증가)
4. [ ] 커밋 → 빌드 → TestFlight/Play 내부테스트 → 심사

> 관련 문서: `RELEASE_CHECKLIST.md`, `docs/app-store-review-notes.md`, `docs/cross-device-and-expansion-notes.md`
