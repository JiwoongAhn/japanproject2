import { summarizeManabaMail } from '../../src/utils/manabaMailSummary';

// 실제 사용자 메일 샘플(2026-06-02 수집) 기반 픽스처
// 본문은 plain text 그대로 (manaba 메일은 text/plain로 도착)
const reportMail = {
  subject: 'manaba - Ｗｅｂデザインの基礎 - レポート公開のお知らせ',
  sender: 'manaba@kokushikan.manaba.jp',
  bodyHtml: `manaba からのお知らせです。
[Ｗｅｂデザインの基礎] に、新しくレポートが公開されました。

--レポート情報--
[コース名]：Ｗｅｂデザインの基礎
[課題名]：【練習問題07】HTMLの詳細④　画像の挿入
[受付開始日時]：2026-06-02 15:00:00
[受付終了日時]：2026-06-02 16:25:00
----------------

manaba にログインし、内容を確認してください。
PC：https://kokushikan.manaba.jp/ct/course_3381080_report_3467474
`,
};

const newsMail = {
  subject: 'manaba - キャリア形成支援センター - コースニュース掲示のお知らせ',
  sender: 'manaba@kokushikan.manaba.jp',
  bodyHtml: `manaba からのお知らせです。
[キャリア形成支援センター] に、コースニュースが掲示されました。

--コースニュース情報--
[コース名]：キャリア形成支援センター
[タイトル]：【28卒】大学主催インターンシップ　※ES選考結果発表について
[作成者]：宮川　愛梨
[更新日時]：2026-06-01 08:52:44
※添付ファイルあり
--------------------

manaba にログインし、内容を確認してください。`,
};

const newsShortMail = {
  subject: 'manaba - 日本的経営 - コースニュース掲示のお知らせ',
  sender: 'manaba@kokushikan.manaba.jp',
  bodyHtml: `manaba からのお知らせです。
[日本的経営] に、コースニュースが掲示されました。

--コースニュース情報--
[コース名]：日本的経営
[タイトル]：中間課題をリリース
[作成者]：宮田　純
--------------------`,
};

describe('summarizeManabaMail', () => {
  describe('レポート公開 (과제)', () => {
    const r = summarizeManabaMail(reportMail);

    it('타입을 課題로 판정한다', () => {
      expect(r.type.key).toBe('report');
      expect(r.type.icon).toBe('📝');
    });

    it('과목명을 [コース名]에서 추출한다', () => {
      expect(r.courseName).toBe('Ｗｅｂデザインの基礎');
    });

    it('요약을 [課題名]에서 추출한다', () => {
      expect(r.summary).toBe('【練習問題07】HTMLの詳細④　画像の挿入');
    });

    it('마감일을 짧은 형식으로 변환한다', () => {
      expect(r.deadline).toBe('06/02 16:25');
    });

    it('첨부 없음을 false로 판정한다', () => {
      expect(r.hasAttach).toBe(false);
    });
  });

  describe('コースニュース (공지) + 첨부', () => {
    const r = summarizeManabaMail(newsMail);

    it('타입을 お知らせ로 판정한다', () => {
      expect(r.type.key).toBe('news');
      expect(r.type.icon).toBe('📢');
    });

    it('요약을 [タイトル]에서 추출한다', () => {
      expect(r.summary).toBe(
        '【28卒】大学主催インターンシップ　※ES選考結果発表について'
      );
    });

    it('작성자를 추출한다', () => {
      expect(r.author).toBe('宮川　愛梨');
    });

    it('첨부 있음을 true로 판정한다', () => {
      expect(r.hasAttach).toBe(true);
    });

    it('공지에는 마감일이 없다', () => {
      expect(r.deadline).toBeNull();
    });
  });

  describe('コースニュース (짧은 본문)', () => {
    const r = summarizeManabaMail(newsShortMail);

    it('과목명과 요약을 모두 추출한다', () => {
      expect(r.courseName).toBe('日本的経営');
      expect(r.summary).toBe('中間課題をリリース');
    });
  });

  describe('fallback / edge case', () => {
    it('body가 비어도 제목에서 과목명을 뽑는다', () => {
      const r = summarizeManabaMail({
        subject: 'manaba - 心理学概論 - 小テスト公開のお知らせ',
        bodyHtml: '',
      });
      expect(r.courseName).toBe('心理学概論');
      expect(r.type.key).toBe('quiz');
    });

    it('courseHint를 fallback으로 사용한다', () => {
      const r = summarizeManabaMail({
        subject: '別件',
        bodyHtml: 'manaba からのお知らせです。',
        courseHint: 'Hintコース',
      });
      expect(r.courseName).toBe('Hintコース');
    });

    it('60자 초과 요약은 자른다', () => {
      const longTitle = 'あ'.repeat(80);
      const r = summarizeManabaMail({
        subject: 'manaba - X - お知らせ',
        bodyHtml: `[タイトル]：${longTitle}`,
      });
      expect(r.summary.length).toBeLessThanOrEqual(61); // 60 + …
      expect(r.summary.endsWith('…')).toBe(true);
    });

    it('HTML 태그가 있어도 텍스트로 변환 후 파싱한다', () => {
      const r = summarizeManabaMail({
        subject: 'manaba - X - レポート公開のお知らせ',
        bodyHtml: '<p>[コース名]：HTMLコース</p><br>[課題名]：第1回',
      });
      expect(r.courseName).toBe('HTMLコース');
      expect(r.summary).toBe('第1回');
    });

    it('전부 비어 있어도 안전하게 동작한다', () => {
      const r = summarizeManabaMail({});
      expect(r.type.key).toBe('other');
      expect(r.courseName).toBeNull();
      expect(r.summary).toBeNull();
    });
  });
});
