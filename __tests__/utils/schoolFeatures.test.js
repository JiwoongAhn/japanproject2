// 학교별 기능 표 — 순수 함수 + 문서(docs/university-lms-profiles.md) 최신 여부
import fs from 'fs';
import path from 'path';
import { universities } from '../../src/constants/universities';
import { universityLinks } from '../../src/constants/universityLinks';
import {
  autoLoginStatus,
  schoolFeatureRow,
  buildSchoolFeatureTable,
  replaceBetweenMarkers,
  DOC_BEGIN,
  DOC_END,
} from '../../src/utils/schoolFeatures';

describe('autoLoginStatus', () => {
  it('autoLoginHosts 가 있으면 ON (앱이 실제로 읽는 값)', () => {
    expect(autoLoginStatus({ autoLoginHosts: ['a.example'] })).toBe('ON');
  });
  it('차단이 후보보다 우선 표시된다', () => {
    expect(autoLoginStatus({ autoLoginCandidates: ['a.example'], autoLoginBlocked: '사유' })).toBe('⛔차단');
  });
  it('후보만 있으면 검증대기, 아무것도 없으면 —', () => {
    expect(autoLoginStatus({ autoLoginCandidates: ['a.example'] })).toBe('검증대기');
    expect(autoLoginStatus({})).toBe('—');
    expect(autoLoginStatus(undefined)).toBe('—');
  });
});

describe('schoolFeatureRow', () => {
  it('국사관 = 一括·자동 로그인·manaba 통지 전부 켜짐', () => {
    const kok = universities.find((u) => u.id === 'kokushikan');
    const r = schoolFeatureRow(kok, universityLinks.kokushikan);
    expect(r).toMatchObject({ bulkImport: true, autoLogin: 'ON', manabaNotice: true, lms: 'manaba', portal: 'kaede-i' });
  });
  it('홈페이지만 있는 학교(日本) = LMS 없음', () => {
    const nu = universities.find((u) => u.id === 'nihon-u');
    expect(schoolFeatureRow(nu, universityLinks['nihon-u']).lms).toBe('');
  });
});

describe('buildSchoolFeatureTable', () => {
  it('헤더 2줄 + 학교 수만큼 행', () => {
    const lines = buildSchoolFeatureTable(universities, universityLinks).split('\n');
    expect(lines).toHaveLength(universities.length + 2);
  });
});

describe('replaceBetweenMarkers', () => {
  it('마커 사이만 교체하고 앞뒤는 보존한다', () => {
    const doc = `앞\n${DOC_BEGIN}\n옛 표\n${DOC_END}\n뒤`;
    expect(replaceBetweenMarkers(doc, 'T')).toBe(`앞\n${DOC_BEGIN}\nT\n${DOC_END}\n뒤`);
  });
  it('마커가 없으면 null', () => {
    expect(replaceBetweenMarkers('마커 없음', 'T')).toBeNull();
  });
});

it('SF-DOC: docs/university-lms-profiles.md 의 기능 표가 최신이다 (아니면 npm run school:features)', () => {
  const docPath = path.join(__dirname, '../../docs/university-lms-profiles.md');
  const doc = fs.readFileSync(docPath, 'utf8');
  const table = buildSchoolFeatureTable(universities, universityLinks);
  expect(replaceBetweenMarkers(doc, table)).toBe(doc);
});
