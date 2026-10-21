// manaba 통지 푸시 메시지 — mail-inbound / push-retry-worker / send-test-push 공용
//   AI 요약이 있으면(사용자가 「通知にAI要約を表示」 ON) 잠금화면에서 바로 읽히게 본문에 요약을 넣는다.
//   없으면 기존 그대로(제목만).

// Expo/APNs 한 건 상한 4096 bytes — 여유를 두고 넘으면 data 쪽 큰 항목부터 뺀다
const MAX_MESSAGE_BYTES = 3800;
const byteLength = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;

export type NoticePayload = {
  noticeId?: string;
  subject?: string;
  bodyHtml?: string;
  noticeUrl?: string | null;
  aiSummary?: string | null;
};

export function buildNoticePushMessage(to: string, payload: NoticePayload, titlePrefix = '') {
  const subject = payload.subject ?? '';
  const summary = payload.aiSummary?.trim();
  const message: Record<string, unknown> = summary
    ? { to, title: `${titlePrefix}📢 ${subject || 'manaba 新着通知'}`.slice(0, 80), body: summary }
    : { to, title: `${titlePrefix}📢 manaba 新着通知`, body: subject };
  message.data = { ...payload };
  message.sound = 'default';

  // 너무 크면: 본문 HTML → 요약 순으로 data 에서 뺀다 (앱은 noticeId 로 DB 에서 다시 읽는다)
  if (byteLength(message) > MAX_MESSAGE_BYTES) {
    const { bodyHtml: _b, ...rest } = message.data as NoticePayload;
    message.data = rest;
  }
  if (byteLength(message) > MAX_MESSAGE_BYTES) {
    const { aiSummary: _s, ...rest } = message.data as NoticePayload;
    message.data = rest;
  }
  return message;
}
