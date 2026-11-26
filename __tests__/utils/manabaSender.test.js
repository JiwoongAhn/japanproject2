import { isAllowedSender, isManabaLink, extractManabaUrl } from '../../supabase/functions/_shared/manabaSender';

describe('manaba 보낸 사람 판정', () => {
  it('MS-01 진짜 manaba 주소는 통과', () => {
    expect(isAllowedSender('no-reply@kokushikan.manaba.jp')).toBe(true);
    expect(isAllowedSender('NO-REPLY@Daito.Manaba.JP')).toBe(true);
    expect(isAllowedSender('x@manaba.jp')).toBe(true);
    expect(isAllowedSender('x@ace.toyo.ac.jp')).toBe(true);
  });
  it('MS-02 끝 글자만 같은 가짜 주소는 거절', () => {
    expect(isAllowedSender('x@fakemanaba.jp')).toBe(false);
    expect(isAllowedSender('x@manaba.jp.evil.com')).toBe(false);
    expect(isAllowedSender('x@evil-ace.toyo.ac.jp.com')).toBe(false);
    expect(isAllowedSender('')).toBe(false);
    expect(isAllowedSender('manaba.jp')).toBe(false);
  });
});

describe('manaba 링크 판정', () => {
  it('MS-03 진짜 manaba 링크', () => {
    expect(isManabaLink('https://kokushikan.manaba.jp/ct/course_1_news_2')).toBe(true);
    expect(isManabaLink('https://www.ace.toyo.ac.jp/ct/home')).toBe(true);
  });
  it('MS-04 가짜 링크는 거절', () => {
    ['https://manaba.jp.evil.com/ct/x', 'https://fakemanaba.jp/ct/x', 'https://kokushikan.manaba.jp@evil.com/',
     'https://kokushikan.manaba.jp:8443/ct', 'javascript://manaba.jp', 'https://ace.toyo.ac.jp.evil.com/']
      .forEach((u) => expect(isManabaLink(u)).toBe(false));
  });
  it('MS-05 본문에서 가짜는 건너뛰고 진짜 링크만 뽑는다', () => {
    const html = '<a href="https://manaba.jp.evil.com/ct/a">x</a> <a href="https://kokushikan.manaba.jp/ct/course_9_news_3">本文</a>';
    expect(extractManabaUrl(html)).toBe('https://kokushikan.manaba.jp/ct/course_9_news_3');
    expect(extractManabaUrl('<a href="https://fakemanaba.jp/x">x</a>')).toBeNull();
  });
});
