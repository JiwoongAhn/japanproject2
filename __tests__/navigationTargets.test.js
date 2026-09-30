// 네비게이션 대상 정합성 검사
//
// [배경] 2026-09-29에 課題를 하단 탭에서 루트 모달로 옮겼다. 이때 화면 어딘가에
//   navigate('Assignment')가 남아 있는데 등록이 사라지면, 그 버튼을 누르는 순간에만
//   터진다. Jest는 순수 함수만 보고 화면을 렌더하지 않으므로 이런 오류를 못 잡는다.
//   → 소스에서 "이동 대상"과 "등록된 화면 이름"을 모두 뽑아 대조한다.
//
// 이 테스트는 실행이 아니라 소스 텍스트를 검사하므로 네이티브 모듈이 필요 없다.

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');

// src 아래 모든 .js 파일 경로
function listJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsFiles(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = listJsFiles(SRC);
const sources = new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));

// navigation.navigate('X') / .replace('X') / .push('X') 의 X 수집
function collectTargets() {
  const targets = new Map(); // 화면이름 → [파일...]
  const re = /\.(?:navigate|replace|push)\(\s*'([A-Za-z][A-Za-z0-9_]*)'/g;
  for (const [file, src] of sources) {
    let m;
    while ((m = re.exec(src)) !== null) {
      const name = m[1];
      if (!targets.has(name)) targets.set(name, []);
      targets.get(name).push(path.relative(SRC, file));
    }
  }
  return targets;
}

// <Xxx.Screen name="Y" 의 Y 수집 (네비게이터 등록 이름)
function collectRegistered() {
  const names = new Set();
  const re = /\.Screen\s+name="([A-Za-z][A-Za-z0-9_]*)"/g;
  for (const [, src] of sources) {
    let m;
    while ((m = re.exec(src)) !== null) names.add(m[1]);
  }
  return names;
}

// 중첩 네비게이터로 이동할 때 쓰는 { screen: 'Y' } 의 Y 수집
function collectNestedScreens() {
  const names = new Set();
  const re = /screen:\s*'([A-Za-z][A-Za-z0-9_]*)'/g;
  for (const [, src] of sources) {
    let m;
    while ((m = re.exec(src)) !== null) names.add(m[1]);
  }
  return names;
}

describe('네비게이션 대상이 모두 등록돼 있다', () => {
  const registered = collectRegistered();
  const targets = collectTargets();

  it('등록된 화면 이름을 실제로 찾아낸다 (검사 자체가 동작하는지 확인)', () => {
    // 이 테스트가 빈 집합을 비교하며 무의미하게 통과하는 것을 막는다
    expect(registered.size).toBeGreaterThan(20);
    expect(targets.size).toBeGreaterThan(10);
  });

  it('navigate/replace/push 대상이 전부 등록된 화면이다', () => {
    const missing = [];
    for (const [name, where] of targets) {
      if (!registered.has(name)) missing.push(`${name} ← ${where.join(', ')}`);
    }
    expect(missing).toEqual([]);
  });

  it('중첩 이동({ screen: ... })의 대상도 전부 등록된 화면이다', () => {
    const missing = [...collectNestedScreens()].filter((n) => !registered.has(n));
    expect(missing).toEqual([]);
  });
});

describe('課題 탭 → 루트 모달 전환 (2026-09-29)', () => {
  const mainTab = sources.get(path.join(SRC, 'navigation', 'MainTab.js'));
  const appNav = sources.get(path.join(SRC, 'navigation', 'AppNavigator.js'));

  it('하단 탭은 4개다', () => {
    const tabCount = (mainTab.match(/<Tab\.Screen/g) || []).length;
    expect(tabCount).toBe(4);
  });

  it('하단 탭에 課題가 없다', () => {
    expect(mainTab).not.toContain('AssignmentStack');
    expect(mainTab).not.toContain("tabBarLabel: '課題'");
  });

  it('課題는 루트 스택에 모달로 등록돼 있다', () => {
    expect(appNav).toContain('import AssignmentStack');
    expect(appNav).toMatch(/name="Assignment"[\s\S]{0,200}AssignmentStack/);
  });

  it('통지 화면은 MainTab을 경유해 課題로 가지 않는다 (모달 중첩 방지)', () => {
    const notice = sources.get(path.join(SRC, 'screens', 'notice', 'NoticePreviewModal.js'));
    // 예전 경로: navigate('MainTab', { screen: 'Assignment' }) → 지금은 replace('Assignment')
    expect(notice).not.toMatch(/navigate\('MainTab'[\s\S]{0,80}Assignment/);
    expect(notice).toContain("replace('Assignment'");
  });
});
