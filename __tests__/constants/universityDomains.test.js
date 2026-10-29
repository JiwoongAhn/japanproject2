import fs from 'fs';
import path from 'path';
import { universities } from '../../src/constants/universities';

// 서버(DB)는 가입 메일의 도메인으로 학교를 정하고, 모르는 도메인은 가입을 거절한다
// (supabase/migrations/20261029_security_fix_1.sql 의 university_domains).
// 앱에 학교를 추가하고 DB 목록을 빠뜨리면 그 학교 학생은 가입할 수 없으므로 여기서 잡는다.
const migrationsDir = path.join(__dirname, '../../supabase/migrations');
const allSql = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf8'))
  .join('\n');

describe('university_domains (DB) ↔ universities.js (앱)', () => {
  test.each(universities.map((u) => [u.name, u.emailDomain]))(
    'US-DOM %s (%s) 가 마이그레이션의 university_domains 에 있다',
    (name, domain) => {
      expect(allSql).toContain(`('${domain}', '${name}')`);
    },
  );
});
