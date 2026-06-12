import PostalMime from 'postal-mime';

// Cloudflare Email Worker — 메일전달 방식 푸시의 진입점.
// Cloudflare Email Routing의 catch-all(*@unipas.app)이 이 Worker로 메일을 보낸다.
//   1) To 주소 {token}@unipas.app 에서 token 추출 → 학생 식별
//   2) raw MIME 파싱(postal-mime)으로 제목/발신자/본문HTML 추출
//   3) manaba 발신자만 통과 (그 외는 조용히 무시)
//   4) 공유시크릿 헤더를 붙여 Supabase Edge Function(mail-inbound) 호출
//
// 필요한 환경변수(wrangler secret):
//   SUPABASE_FUNC_URL   = https://<project>.supabase.co/functions/v1/mail-inbound
//   MAIL_INBOUND_SECRET = Supabase 함수와 동일한 공유 비밀값

const ALLOWED_SENDERS = ['kokushikan.manaba.jp', 'manaba.jp'];

export default {
  async email(message, env, ctx) {
    try {
      // ① To 주소에서 token 추출
      const to = (message.to || '').toLowerCase();
      const token = to.split('@')[0];
      if (!token) {
        console.warn('[worker] token 없음 — 무시:', to);
        return;
      }

      // ② raw 메일 파싱 (스트림은 한 번만 읽을 수 있음)
      const email = await PostalMime.parse(message.raw);
      const fromAddress = (email.from?.address || message.from || '').toLowerCase();
      const subject = email.subject || '';
      const bodyHtml = email.html || email.text || '';
      const receivedAt = (email.date && new Date(email.date).toISOString()) || new Date().toISOString();

      // ③ 발신자 도메인 검증 — manaba 외 메일은 무시 (서버에서도 재검증함)
      const senderDomain = fromAddress.split('@')[1] || '';
      if (!ALLOWED_SENDERS.some((d) => senderDomain.endsWith(d))) {
        console.warn('[worker] 비허용 발신자 — 무시:', senderDomain);
        return;
      }

      // ④ Supabase Edge Function 호출
      const res = await fetch(env.SUPABASE_FUNC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mail-secret': env.MAIL_INBOUND_SECRET,
        },
        body: JSON.stringify({ token, subject, fromAddress, bodyHtml, receivedAt }),
      });

      if (!res.ok) {
        console.error('[worker] mail-inbound 호출 실패:', res.status, await res.text());
      }
    } catch (e) {
      console.error('[worker] 예외:', e);
    }
  },
};
