import { formatTimeAgo } from '../../src/utils/community';

describe('formatTimeAgo', () => {
  const FIXED_NOW = new Date('2026-04-14T12:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // C-01: 30초 전 → 'たった今'
  it('C-01: 30초 전이면 たった今 를 반환한다', () => {
    const timestamp = new Date(Date.now() - 30 * 1000).toISOString();
    expect(formatTimeAgo(timestamp)).toBe('たった今');
  });

  // C-02: 10분 전 → '10分前'
  it('C-02: 10분 전이면 10分前 를 반환한다', () => {
    const timestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(formatTimeAgo(timestamp)).toBe('10分前');
  });

  // C-03: 59분 전 → '59分前'
  it('C-03: 59분 전이면 59分前 를 반환한다', () => {
    const timestamp = new Date(Date.now() - 59 * 60 * 1000).toISOString();
    expect(formatTimeAgo(timestamp)).toBe('59分前');
  });

  // C-04: 60분 전 → '1時間前'
  it('C-04: 60분 전이면 1時間前 를 반환한다', () => {
    const timestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(timestamp)).toBe('1時間前');
  });

  // C-05: 23시간 전 → '23時間前'
  it('C-05: 23시간 전이면 23時間前 를 반환한다', () => {
    const timestamp = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(timestamp)).toBe('23時間前');
  });

  // C-06: 24시간 전 → '1日前'
  it('C-06: 24시간 전이면 1日前 를 반환한다', () => {
    const timestamp = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(timestamp)).toBe('1日前');
  });

  // C-07: 72시간 전 → '3日前'
  it('C-07: 72시간 전이면 3日前 를 반환한다', () => {
    const timestamp = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(timestamp)).toBe('3日前');
  });
});
