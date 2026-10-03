import { splitTextWithLinks, normalizeUrl, hasLink } from '../src/utils/linkify';

const links = (t) => splitTextWithLinks(t).filter((p) => p.type === 'link');
const rebuilt = (t) => splitTextWithLinks(t).map((p) => p.value).join('');

describe('splitTextWithLinks', () => {
  it('링크가 없으면 텍스트 한 조각', () => {
    expect(splitTextWithLinks('授業が休講になりました')).toEqual([
      { type: 'text', value: '授業が休講になりました' },
    ]);
  });

  it('빈 값은 빈 배열', () => {
    expect(splitTextWithLinks('')).toEqual([]);
    expect(splitTextWithLinks(null)).toEqual([]);
  });

  it('문장 중간의 URL 을 찾는다', () => {
    const parts = splitTextWithLinks('詳しくは https://example.com/a を見て');
    expect(parts).toEqual([
      { type: 'text', value: '詳しくは ' },
      { type: 'link', value: 'https://example.com/a', url: 'https://example.com/a' },
      { type: 'text', value: ' を見て' },
    ]);
  });

  it('⚠️ 일본어 전각 마루(。)가 URL 에 먹히지 않는다', () => {
    const t = 'ここです。https://example.com/a。よろしく';
    expect(links(t)[0].url).toBe('https://example.com/a');
  });

  it('⚠️ 전각 괄호로 감싼 URL 도 깨지지 않는다', () => {
    const t = '参考（https://example.com/b）です';
    expect(links(t)[0].url).toBe('https://example.com/b');
  });

  it('반각 마침표·쉼표는 URL 에서 떼어낸다', () => {
    expect(links('見てね https://example.com/c.')[0].url).toBe('https://example.com/c');
    expect(links('a https://example.com/d, b')[0].url).toBe('https://example.com/d');
  });

  it('⚠️ 괄호가 짝이 맞는 URL 은 닫는 괄호를 유지한다 (위키백과 주소)', () => {
    const t = 'https://ja.wikipedia.org/wiki/Foo_(bar)';
    expect(links(t)[0].url).toBe('https://ja.wikipedia.org/wiki/Foo_(bar)');
  });

  it('⚠️ 문장을 감싼 반각 괄호는 URL 에서 떼어낸다', () => {
    const t = '(https://example.com/e)';
    expect(links(t)[0].url).toBe('https://example.com/e');
  });

  it('www. 로 시작하면 https 를 붙여서 연다 (표시는 원문 그대로)', () => {
    const [link] = links('www.example.com を見て');
    expect(link.value).toBe('www.example.com');
    expect(link.url).toBe('https://www.example.com');
  });

  it('URL 이 여러 개면 전부 찾는다', () => {
    const found = links('A https://a.com B https://b.com C');
    expect(found.map((l) => l.url)).toEqual(['https://a.com', 'https://b.com']);
  });

  it('⚠️ 쪼갠 조각을 다시 이으면 원문과 같아야 한다 (글자 유실 방지)', () => {
    const cases = [
      '詳しくは https://example.com/a を見て',
      'ここです。https://example.com/a。よろしく',
      '参考（https://example.com/b）です',
      '(https://example.com/e)',
      'A https://a.com B https://b.com C',
      'www.example.com だけ',
      'https://example.com/c.',
      'リンクなしの本文です',
    ];
    cases.forEach((t) => expect(rebuilt(t)).toBe(t));
  });

  it('http 도 인식한다', () => {
    expect(links('http://example.com/f')[0].url).toBe('http://example.com/f');
  });

  it('쿼리스트링·앵커가 있는 긴 URL 도 통째로 잡는다', () => {
    const t = 'https://example.com/path?a=1&b=2#sec';
    expect(links(t)[0].url).toBe(t);
  });
});

describe('normalizeUrl', () => {
  it('스킴이 있으면 그대로', () => {
    expect(normalizeUrl('http://a.com')).toBe('http://a.com');
    expect(normalizeUrl('https://a.com')).toBe('https://a.com');
  });
  it('없으면 https 를 붙인다', () => {
    expect(normalizeUrl('www.a.com')).toBe('https://www.a.com');
  });
});

describe('hasLink', () => {
  it('링크 유무를 판정한다', () => {
    expect(hasLink('ただの本文')).toBe(false);
    expect(hasLink('https://a.com')).toBe(true);
    expect(hasLink('')).toBe(false);
  });
});
