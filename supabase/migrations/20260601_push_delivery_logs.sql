-- 푸시 발송 로그 테이블
-- Why: Expo Push API는 ticket → receipt 2단계라 fire-and-forget으로는 실제 전달 여부를 알 수 없음.
-- 어싱크 보정(receipt 폴링, 재시도, 정리)을 위해 발송 상태를 영속화한다.

CREATE TABLE IF NOT EXISTS public.push_delivery_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notice_id       uuid REFERENCES public.manaba_notices(id) ON DELETE CASCADE,
  expo_token      text NOT NULL,
  ticket_id       text,
  status          text NOT NULL CHECK (status IN
                    ('pending','delivered','retry_pending','dead','permanent_fail')),
  attempts        smallint NOT NULL DEFAULT 1,
  last_error_code text,
  last_error_msg  text,
  next_retry_at   timestamptz,
  payload         jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- retry 스캔용 부분 인덱스 (큐 크기에 비례한 O(N))
CREATE INDEX IF NOT EXISTS idx_pdl_retry
  ON public.push_delivery_logs (next_retry_at)
  WHERE status = 'retry_pending';

-- pending(15분 후 receipt 조회 대상) 스캔용
CREATE INDEX IF NOT EXISTS idx_pdl_pending
  ON public.push_delivery_logs (created_at)
  WHERE status = 'pending';

-- 마이페이지 배지(사용자 본인 최근 발송) 조회용
CREATE INDEX IF NOT EXISTS idx_pdl_user
  ON public.push_delivery_logs (user_id, created_at DESC);

-- 동일 공지를 동일 사용자에게 중복 발송하지 않도록 (활성 상태에서만)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pdl_active_notice_user
  ON public.push_delivery_logs (notice_id, user_id)
  WHERE status IN ('pending','delivered','retry_pending');

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.set_pdl_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pdl_updated_at ON public.push_delivery_logs;
CREATE TRIGGER trg_pdl_updated_at
  BEFORE UPDATE ON public.push_delivery_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_pdl_updated_at();

-- RLS: service_role만 R/W, 사용자는 자기 행 SELECT만 (마이페이지 배지)
ALTER TABLE public.push_delivery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pdl_user_select_own ON public.push_delivery_logs;
CREATE POLICY pdl_user_select_own
  ON public.push_delivery_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- service_role은 RLS 우회하므로 별도 정책 불필요
