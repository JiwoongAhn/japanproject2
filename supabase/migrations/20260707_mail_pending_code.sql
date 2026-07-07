-- manaba 메일주소 인증코드(6자리) 임시 저장 컬럼 추가
-- Why: 국사관 manaba는 새 알림주소 등록 시 "인증 링크"가 아니라 "6자리 코드"를 보낸다.
--      이 코드는 학생이 볼 수 없는 우리 서버({token}@unipas.app)로 오므로,
--      mail-inbound가 코드를 뽑아 여기 담아두면 앱이 폴링해 학생에게 화면으로 표시한다.
--      학생이 그 코드를 manaba 인증칸에 입력하면 등록이 완료된다.

ALTER TABLE public.mail_subscriptions
  ADD COLUMN IF NOT EXISTS pending_code     TEXT,        -- 최근 수신한 6자리 인증코드 (인증완료 시 NULL로 비움)
  ADD COLUMN IF NOT EXISTS code_received_at TIMESTAMPTZ;  -- 코드 수신 시각 (오래된 코드 구분·만료 판단용)
