// Node 로 src/ 코드를 직접 실행할 때 쓰는 보조 로더.
// 앱 코드는 확장자 없는 import('./autoLoginPolicy')를 쓴다. Metro·Jest 는 알아서 .js 를 찾지만
// 순수 Node(ESM)는 못 찾으므로, 찾기 실패 시 '.js' 를 붙여 한 번 더 시도한다.
// 사용: node --import ./scripts/lib/resolve-js.mjs scripts/xxx.mjs
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (err?.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !specifier.endsWith('.js')) {
      return next(specifier + '.js', context);
    }
    throw err;
  }
}`),
  import.meta.url
);
