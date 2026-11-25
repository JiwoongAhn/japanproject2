// 화면에 한국어가 나오지 않는지 검사 — 앱 사용자는 일본 대학생이다
//   계기(2026-11-25): 홈 공지에 「📎 첨부」가 그대로 나가고 있었다. 주석·개발자용 기록(console·throw)은 한국어여도 된다
import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

const HANGUL = /[ㄱ-ㅎㅏ-ㅣ가-힣]/;
const SRC = path.join(__dirname, '../src');
// 화면에 나오지 않는 파일 (이유를 꼭 적을 것)
const ALLOWED = {
  'utils/profanity.js': '걸러낼 욕설 목록',
  'utils/schoolFeatures.js': '개발 문서(docs) 자동 생성용',
  'utils/timetableParser.js': '개발자용 분류 사유 (화면에 안 나옴)',
};

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return listFiles(p);
    return p.endsWith('.js') ? [p] : [];
  });
}

// console.xxx(...) 와 throw 안의 글은 개발자만 본다
function isDevOnly(nodePath) {
  return !!nodePath.findParent((p) =>
    p.isThrowStatement() ||
    (p.isCallExpression() && p.get('callee').isMemberExpression() && p.node.callee.object?.name === 'console'));
}

export function findHangul(code) {
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });
  const found = [];
  const check = (text) => (p) => {
    const value = text(p.node);
    if (HANGUL.test(value) && !isDevOnly(p)) found.push(`${p.node.loc.start.line}행: ${value.trim().slice(0, 40)}`);
  };
  traverse(ast, {
    StringLiteral: check((n) => n.value),
    JSXText: check((n) => n.value),
    // 앱 안 브라우저에 넣는 코드·HTML 안의 주석은 화면에 안 나오므로 뺀다
    TemplateElement: check((n) => n.value.raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|\s)\/\/.*$/gm, '')),
  });
  return found;
}

describe('화면 문구에 한국어가 없다', () => {
  test('UL-01 검사기가 문자열·화면 글자를 잡고, 주석·console·throw 는 넘어간다', () => {
    expect(findHangul("const a = '첨부';")).toHaveLength(1);
    expect(findHangul('const a = <Text>📎 첨부</Text>;')).toHaveLength(1);
    expect(findHangul('const a = `${n}개`;')).toHaveLength(1);
    expect(findHangul("// 첨부\nconsole.log('첨부'); if (x) throw new Error('첨부');")).toHaveLength(0);
  });

  test('UL-02 src 전체에 한국어 문구가 없다', () => {
    const bad = listFiles(SRC).flatMap((file) => {
      const rel = path.relative(SRC, file);
      if (ALLOWED[rel]) return [];
      return findHangul(fs.readFileSync(file, 'utf8')).map((m) => `${rel} ${m}`);
    });
    expect(bad).toEqual([]);
  });
});

// Android 의 Alert 는 버튼이 3개까지만 보인다 → 4번째(대개 キャンセル)가 사라져 창을 못 닫는다
//   계기(2026-11-25): 신고 사유 창에서 취소할 방법이 없어 잘못 누르면 꼭 신고가 됐다
export function findLongAlerts(code) {
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });
  const found = [];
  traverse(ast, {
    CallExpression(p) {
      const c = p.node.callee;
      if (c.type !== 'MemberExpression' || c.object.name !== 'Alert' || c.property.name !== 'alert') return;
      const buttons = p.node.arguments[2];
      if (buttons?.type === 'ArrayExpression' && buttons.elements.length > 3) found.push(p.node.loc.start.line);
    },
  });
  return found;
}

describe('Alert 버튼은 3개까지', () => {
  test('UL-03 검사기가 4개짜리를 잡는다', () => {
    expect(findLongAlerts("Alert.alert('a', 'b', [{}, {}, {}, {}]);")).toEqual([1]);
    expect(findLongAlerts("Alert.alert('a', 'b', [{}, {}, {}]);")).toEqual([]);
  });
  test('UL-04 src 전체에 4개 이상인 Alert 가 없다 (4개 이상은 useConfirm 의 choice)', () => {
    const bad = listFiles(SRC).flatMap((f) => findLongAlerts(fs.readFileSync(f, 'utf8')).map((l) => `${path.relative(SRC, f)}:${l}`));
    expect(bad).toEqual([]);
  });
});
