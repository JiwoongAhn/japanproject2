import { createClient } from 'jsr:@supabase/supabase-js@2';

// 자동 작업(pg_cron) 전용 함수의 입구 검사 (2026-11-18)
//   pg_cron 은 공개 열쇠(anon)로 함수를 부른다 → 열쇠만으로는 "자동 작업인지 외부인인지" 구별이 안 된다.
//   그래서 Vault(DB 금고) 암호를 x-health-secret 헤더로 함께 보내고, 여기서 맞는지 확인한다.
//   암호는 건강검진(health-check)과 같은 것을 쓴다(이름만 health_check_secret).
//   service_role(개발자가 CLI로 직접 실행)도 허용한다.

// verify_jwt 가 서명은 이미 검증했다 → 역할(role)만 읽는다
function roleOf(req: Request): string | null {
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const payload = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload))?.role ?? null;
  } catch {
    return null;
  }
}

export async function isCronAllowed(req: Request): Promise<boolean> {
  if (roleOf(req) === 'service_role') return true;
  const secret = req.headers.get('x-health-secret');
  if (!secret) return false;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data } = await admin.rpc('health_check_secret_ok', { p_secret: secret });
  return data === true;
}

export function forbidden() {
  return new Response(JSON.stringify({ error: 'forbidden' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}
