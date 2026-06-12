# mail-inbound-worker (Cloudflare Email Worker)

학생이 학교 Outlook에서 manaba 알림 메일을 본인 전용 `{token}@unipas.app` 주소로 자동전달하면,
이 Worker가 메일을 받아 파싱한 뒤 Supabase `mail-inbound` 함수로 넘긴다. → 서버가 Expo 푸시 발송.

## 배포 순서 (사용자 직접 수행)

### 1) 의존성 설치 + 로그인
```bash
cd cloudflare/mail-inbound-worker
npm install
npx wrangler login          # 브라우저에서 Cloudflare 계정 인증 (! 로 실행 권장)
```

### 2) 시크릿 등록 (코드에 비밀값을 넣지 않기 위함)
```bash
# Supabase 함수 주소 (project ref = rexnpusrxezuztxmkaex)
npx wrangler secret put SUPABASE_FUNC_URL
#   값: https://rexnpusrxezuztxmkaex.supabase.co/functions/v1/mail-inbound

# Supabase 함수와 똑같이 맞출 공유 비밀값 (아무 긴 랜덤 문자열)
npx wrangler secret put MAIL_INBOUND_SECRET
#   값: (예) openssl rand -hex 32 로 만든 64자리
```
> 같은 `MAIL_INBOUND_SECRET` 값을 Supabase 쪽에도 등록해야 한다(아래 4번).

### 3) Worker 배포
```bash
npm run deploy              # = npx wrangler deploy
```

### 4) Supabase에 동일 시크릿 등록
Supabase 대시보드 → Project Settings → Edge Functions → Secrets 에서
`MAIL_INBOUND_SECRET` = (2번과 같은 값) 추가. (또는 `npx supabase secrets set MAIL_INBOUND_SECRET=...`)

### 5) Cloudflare Email Routing 연결
Cloudflare 대시보드 → `unipas.app` → **Email → Email Routing**
1. Email Routing **활성화** (MX 레코드가 자동 추가됨).
2. **Catch-all address** → Action: **Send to a Worker** → `mail-inbound-worker` 선택.

> ⚠️ MX(수신)와 Resend의 SPF/DKIM(발신, OTP 메일용)은 공존 가능하지만,
> 활성화 후 회원가입 OTP 메일이 정상 발송되는지 1회 확인할 것.

## 동작 점검
- `npx wrangler tail` 로 실시간 로그 확인.
- 학교 Outlook에서 `{token}@unipas.app` 으로 전달 규칙을 건 뒤 manaba 메일 도착 → 로그에 호출 기록 → 실기기 푸시.
