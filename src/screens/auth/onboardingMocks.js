// 온보딩 폰 목업 안의 화면 — 실제 앱 화면(時間割·課題·講義評価·掲示板)을 그대로 축소해 보여준다.
//
// 2026-10-26 사용자: "그림은 실제 어플이랑 같은 화면이면 좋겠어(시간표 2줄은 어색)".
// 그래서 각 화면을 실제 앱과 같은 크기(폭 375 기준, 같은 글자 크기·색·카드 모양)로 그린 뒤
// MockScreen 이 목업 폭에 맞게 통째로 축소한다. 목업이 작아져도(작은 기기) 비율이 그대로 유지된다.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, pastel } from '../../constants/colors';
import { typography } from '../../constants/typography';

const BASE_W = 375; // 그리는 기준 폭(실제 폰 화면 폭) — 이 크기로 그리고 축소한다
const MOCK_BG_LOCK = '#E6EEF9';
const APP_ICON = require('../../../assets/icon.png');

// 슬라이드별 폰 화면 배경색(PhoneMockup 상태바 줄까지 같은 색으로)
export const MOCK_BACKGROUND = {
  timetable: colors.background,
  manabaPush: MOCK_BG_LOCK,
  assignment: colors.background,
  review: colors.background,
  community: colors.background,
  oneTimeLogin: colors.white,
};

// 목업 화면 영역을 재서, 375 폭으로 그린 children 을 그 영역에 꼭 맞게 축소한다
export function MockScreen({ children }) {
  const [box, setBox] = useState(null);
  const onLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  };
  const scale = box ? box.width / BASE_W : 0;
  const innerH = box ? box.height / scale : 0;
  return (
    <View style={styles.fill} onLayout={onLayout}>
      {box && (
        <View
          style={{
            position: 'absolute',
            width: BASE_W,
            height: innerH,
            // transform 은 가운데 기준으로 줄어들므로, 줄어든 결과가 (0,0)에 오도록 위치를 맞춘다
            left: (box.width - BASE_W) / 2,
            top: (box.height - innerH) / 2,
            transform: [{ scale }],
          }}
        >
          {children}
        </View>
      )}
    </View>
  );
}

// 하단 탭바 (MainTab 과 같은 4개 탭)
const TABS = [
  { key: 'home', label: 'ホーム', icon: 'home' },
  { key: 'timetable', label: '時間割', icon: 'calendar' },
  { key: 'board', label: '掲示板', icon: 'chatbubble-ellipses' },
  { key: 'mypage', label: 'マイページ', icon: 'person' },
];
function TabBar({ active }) {
  return (
    <View style={styles.tabBar}>
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <View key={t.key} style={styles.tabItem}>
            <Ionicons name={on ? t.icon : `${t.icon}-outline`} size={24} color={on ? colors.gray900 : colors.gray400} />
            <Text style={[styles.tabLabel, { color: on ? colors.gray900 : colors.gray400 }, on && styles.tabLabelOn]}>
              {t.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function PillButton({ label }) {
  return (
    <View style={styles.pillBtn}>
      <Text style={styles.pillBtnText}>＋ {label}</Text>
    </View>
  );
}

// 잠금화면/배너 알림 한 장 (iOS 스타일)
function PushCard({ title, body, time = '今', style }) {
  return (
    <View style={[styles.push, style]}>
      <Image source={APP_ICON} style={styles.pushIcon} />
      <View style={{ flex: 1 }}>
        <View style={styles.pushTop}>
          <Text style={styles.pushTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.pushTime}>{time}</Text>
        </View>
        <Text style={styles.pushBody} numberOfLines={3}>{body}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 1. 時間割 — 실제 TimetableScreen 과 같은 주간 그리드
// ─────────────────────────────────────────────────────────────
const DAYS = ['月', '火', '水', '木', '金'];
const PERIODS = [
  { n: 1, t: '9:00' }, { n: 2, t: '10:45' }, { n: 3, t: '12:55' }, { n: 4, t: '14:40' }, { n: 5, t: '16:25' },
];
// [요일, 교시, 과목, 교실, 색]
const COURSES = [
  [0, 1, '経営学概論', '10301', pastel.sky],
  [2, 1, 'ビジネスコミュニケーション', '12303', pastel.yellow],
  [1, 2, '応用英語Ⅰ', '11204', pastel.peach],
  [3, 2, 'Webデザインの基礎', 'PC教室2', pastel.rose],
  [0, 3, '心理学入門', '10502', pastel.mint],
  [2, 3, 'スポーツ実習 テニス', '体育館', pastel.pink],
  [4, 3, '異文化理解', '14201', pastel.mint],
  [1, 4, '線形代数', '13105', pastel.lavender],
  [3, 5, '情報リテラシー', '30201', pastel.sky],
];

export function TimetableMock() {
  return (
    <MockScreen>
      <View style={styles.page}>
        <View style={styles.ttHead}>
          <Text style={styles.ttTerm}>2026年 秋学期  ⇄</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.bigTitle}>時間割</Text>
            <View style={styles.row}>
              <View style={styles.bulkChip}>
                <Ionicons name="clipboard-outline" size={15} color={colors.primary} />
                <Text style={styles.bulkChipText}>一括</Text>
              </View>
              <PillButton label="追加" />
            </View>
          </View>
          <View style={[styles.row, { marginTop: 10 }]}>
            <View style={styles.todayDot} />
            <Text style={styles.todayText}>今日は <Text style={{ color: colors.primary, fontWeight: '700' }}>2コマ</Text></Text>
          </View>
        </View>

        <View style={styles.gridCard}>
          <View style={styles.dayRow}>
            <View style={styles.periodCol} />
            {DAYS.map((d, i) => (
              <Text key={d} style={[styles.dayText, i === 0 && { color: colors.primary }]}>{d}</Text>
            ))}
          </View>
          {PERIODS.map((p) => (
            <View key={p.n} style={styles.periodRow}>
              <View style={styles.periodCol}>
                <Text style={styles.periodNum}>{p.n}</Text>
                <Text style={styles.periodTime}>{p.t}</Text>
              </View>
              {DAYS.map((_, di) => {
                const c = COURSES.find(([d, n]) => d === di && n === p.n);
                return (
                  <View key={di} style={[styles.cell, { backgroundColor: c ? c[4].bg : colors.gray50 }]}>
                    {c && (
                      <>
                        <Text style={[styles.cellName, { color: c[4].accent }]} numberOfLines={2}>{c[2]}</Text>
                        <Text style={[styles.cellRoom, { color: c[4].accent }]} numberOfLines={1}>{c[3]}</Text>
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>
      <TabBar active="timetable" />
    </MockScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. manaba お知らせ — 잠금화면에 실제 푸시와 같은 형식(📢 제목 + 요약 본문)
// ─────────────────────────────────────────────────────────────
export function ManabaPushMock() {
  return (
    <MockScreen>
      <View style={styles.lock}>
        <Text style={styles.lockDate}>10月26日 月曜日</Text>
        <Text style={styles.lockTime}>9:41</Text>
        <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 36 }}>
          <PushCard
            title="📢 【休講】経営学概論（10/27 1限）"
            body="10月27日（火）1限の経営学概論は休講です。補講日は後日お知らせします。"
          />
          <PushCard
            time="1時間前"
            title="📢 レポート「第5回レポート」公開"
            body={'経営学概論で新しいレポートが公開されました。\n📝 課題に追加しました（締切 10/30 23:59）'}
          />
        </View>
      </View>
    </MockScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. 課題 — 실제 AssignmentScreen 과 같은 카드 + 위에 「締切前日」 알림 배너
// ─────────────────────────────────────────────────────────────
const STATUS = {
  pending: { label: '未提出', bg: pastel.peach.bg, text: pastel.peach.accent },
  submitted: { label: '提出済', bg: pastel.mint.bg, text: pastel.mint.accent },
};
const ASSIGNMENTS_AUTO = [
  { course: '経営学概論', title: '第5回レポート', due: '2026-10-27 23:59', dday: 'D-1', ddayColor: colors.warning, status: 'pending', auto: true },
  { course: '応用英語Ⅰ', title: '小テスト Unit 6', due: '2026-10-29 16:25', dday: 'D-3', ddayColor: colors.primary, status: 'pending', auto: true },
  { course: '心理学入門', title: 'コメントシート④', due: '2026-10-24 23:59', dday: '', status: 'submitted', auto: true },
];
const ASSIGNMENTS_MANUAL = [
  { course: '情報処理基礎', title: '課題3', due: '2026-10-27', dday: 'D-1', ddayColor: colors.warning, status: 'pending' },
  { course: '英語コミュニケーション', title: 'エッセイ提出', due: '2026-11-02', dday: 'D-7', ddayColor: colors.textSecondary, status: 'pending' },
  { course: '経済学入門', title: '小レポート', due: '2026-10-20', dday: '', status: 'submitted' },
];

export function AssignmentMock({ autoAdd = false }) {
  const list = autoAdd ? ASSIGNMENTS_AUTO : ASSIGNMENTS_MANUAL;
  const first = list[0];
  return (
    <MockScreen>
      {/* 위쪽은 알림 배너 자리 — 배너가 헤더를 가리지 않게 비워 둔다 */}
      <View style={[styles.page, { paddingTop: 92 }]}>
        <View style={[styles.rowBetween, { paddingHorizontal: 16, paddingTop: 8 }]}>
          <View style={styles.row}>
            <Ionicons name="close" size={26} color={colors.gray900} />
            <Text style={[styles.bigTitle, { marginLeft: 8 }]}>課題</Text>
          </View>
          <PillButton label="追加" />
        </View>
        <View style={[styles.row, { paddingHorizontal: 16, marginTop: 14, gap: 8 }]}>
          {['全体', '未提出', '提出済', '期限超過'].map((f, i) => (
            <View key={f} style={[styles.chip, i === 0 && styles.chipOn]}>
              <Text style={[styles.chipText, i === 0 && styles.chipTextOn]}>{f}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.hint}>タップで状態切替 / ···で削除</Text>
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {list.map((a) => {
            const s = STATUS[a.status];
            return (
              <View key={a.title} style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardCourse} numberOfLines={1}>{a.course}</Text>
                  <View style={styles.row}>
                    <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
                      <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
                    </View>
                    <Text style={styles.more}>···</Text>
                  </View>
                </View>
                <Text style={styles.cardTitle}>{a.title}</Text>
                {a.auto && (
                  <View style={styles.autoBadge}>
                    <Ionicons name="sparkles-outline" size={11} color={colors.primary} />
                    <Text style={styles.autoBadgeText}>manabaから自動追加</Text>
                  </View>
                )}
                <View style={styles.rowBetween}>
                  <View style={styles.row}>
                    <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
                    <Text style={styles.cardDue}>{a.due}</Text>
                  </View>
                  {!!a.dday && <Text style={[styles.dday, { color: a.ddayColor }]}>{a.dday}</Text>}
                </View>
              </View>
            );
          })}
        </View>
      </View>
      {/* 마감 전날 18:00 알림 — 실제 deadline-reminder 문구 형식 */}
      <PushCard
        style={styles.banner}
        title="📝 明日締切の課題があります"
        body={`明日${autoAdd ? ' 23:59' : 'まで'}｜${first.course}「${first.title}」`}
      />
    </MockScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. 講義評価 — 실제 CourseReviewScreen 의 카드
// ─────────────────────────────────────────────────────────────
const REVIEWS = [
  { name: '経営学概論', prof: '田中先生', stars: 4, score: '4.0', n: 3, tags: ['#出席ゆるめ', '#テストなし'], quote: '毎回のコメントシートで出席確認。内容は身近な企業の話が多くて聞きやすい。' },
  { name: '線形代数', prof: '佐藤先生', stars: 3, score: '3.0', n: 2, tags: ['#テスト重視', '#課題多め'], quote: '中間と期末の比重が大きいので、演習問題は毎週やっておいた方がいい。' },
  { name: '心理学入門', prof: '鈴木先生', stars: 5, score: '5.0', n: 4, tags: ['#おもしろい', '#おすすめ'], quote: '具体例が多くて分かりやすい。レポートはテーマ自由で書きやすかった。' },
];

export function ReviewMock() {
  return (
    <MockScreen>
      <View style={styles.page}>
        <View style={styles.navHeader}>
          <Ionicons name="chevron-back" size={26} color={colors.gray900} style={{ position: 'absolute', left: 16 }} />
          <Text style={styles.navTitle}>講義評価</Text>
        </View>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.gray500} />
          <Text style={styles.searchText}>授業名・教員名で検索</Text>
        </View>
        <Text style={styles.sectionLabel}>人気の講義評価</Text>
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {REVIEWS.map((r) => (
            <View key={r.name} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.reviewName}>{r.name}</Text>
                <Text style={styles.stars}>
                  {'★'.repeat(r.stars)}<Text style={{ color: colors.gray300 }}>{'★'.repeat(5 - r.stars)}</Text>
                </Text>
              </View>
              <View style={[styles.rowBetween, { marginBottom: 10 }]}>
                <Text style={styles.reviewProf}>{r.prof}</Text>
                <Text style={styles.reviewScore}>{r.score} <Text style={styles.reviewCount}>({r.n})</Text></Text>
              </View>
              <View style={[styles.row, { gap: 6, marginBottom: 10 }]}>
                {r.tags.map((t) => (
                  <View key={t} style={styles.hashTag}><Text style={styles.hashTagText}>{t}</Text></View>
                ))}
              </View>
              <Text style={styles.quote} numberOfLines={2}>“{r.quote}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.fab}>
        <Text style={styles.fabText}>＋ 評価を書く</Text>
      </View>
      <TabBar active="timetable" />
    </MockScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. 掲示板 — 실제 PostListScreen 의 HOT 카드 + 새 글 목록
// ─────────────────────────────────────────────────────────────
const CAT = {
  qa: { label: '質問', color: colors.primary },
  free: { label: '自由', color: colors.success },
  info: { label: '情報', color: colors.warning },
};
const POSTS = [
  { cat: 'qa', time: '12分前', title: '線形代数のテスト範囲ってどこまで？', preview: '第6章まで？それとも演習問題も出る？', like: 3, comment: 8 },
  { cat: 'free', time: '1時間前', title: '今日の学食、カレー売り切れてた', preview: '12時半に行ったらもうなかった…', like: 12, comment: 5 },
];

export function CommunityMock({ schoolName }) {
  return (
    <MockScreen>
      <View style={styles.page}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <Text style={styles.ttTerm}>{schoolName || 'あなたの大学'}</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.bigTitle}>掲示板</Text>
            <PillButton label="投稿" />
          </View>
        </View>
        <View style={[styles.search, { marginTop: 14 }]}>
          <Ionicons name="search" size={18} color={colors.gray500} />
          <Text style={styles.searchText}>投稿を検索...</Text>
        </View>
        <View style={[styles.row, { paddingHorizontal: 16, gap: 8, marginBottom: 16 }]}>
          {['全体', '質問', '自由', '秘密', '情報'].map((f, i) => (
            <View key={f} style={[styles.chip, i === 0 && { backgroundColor: colors.gray900 }]}>
              <Text style={[styles.chipText, i === 0 && styles.chipTextOn]}>{f}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.rowBetween, { paddingHorizontal: 16, marginBottom: 10 }]}>
          <View style={styles.row}>
            <Text style={styles.boardSection}>リアルタイム人気</Text>
            <View style={styles.hotBadge}><Text style={styles.hotText}>HOT</Text></View>
          </View>
          <Text style={styles.boardSub}>直近7日</Text>
        </View>
        <View style={[styles.card, { marginHorizontal: 16 }]}>
          <View style={styles.rowBetween}>
            <View style={styles.row}>
              <View style={styles.anonAvatar} />
              <Text style={styles.anonText}>匿名</Text>
            </View>
            <Text style={styles.boardSub}>10/21 17:29</Text>
          </View>
          <Text style={[styles.postTitle, { marginTop: 8 }]}>履修登録、みんな何コマ入れてる？</Text>
          <Text style={styles.postPreview} numberOfLines={1}>1年後期で20単位ってきつい？</Text>
          <View style={[styles.rowBetween, { marginTop: 8 }]}>
            <Text style={styles.boardSub}>質問</Text>
            <Reactions like={9} comment={21} />
          </View>
        </View>
        <View style={[styles.rowBetween, { paddingHorizontal: 16, marginTop: 20, marginBottom: 8 }]}>
          <Text style={styles.boardSection}>新着</Text>
          <Text style={styles.boardSub}>新しい順</Text>
        </View>
        {POSTS.map((p) => (
          <View key={p.title} style={styles.postRow}>
            <View style={styles.rowBetween}>
              <View style={styles.row}>
                <View style={[styles.catTag, { backgroundColor: `${CAT[p.cat].color}1F` }]}>
                  <Text style={[styles.catTagText, { color: CAT[p.cat].color }]}>{CAT[p.cat].label}</Text>
                </View>
                <Text style={styles.anonText}>匿名</Text>
              </View>
              <Text style={styles.boardSub}>{p.time}</Text>
            </View>
            <Text style={[styles.postTitle, { marginTop: 8 }]}>{p.title}</Text>
            <Text style={styles.postPreview} numberOfLines={1}>{p.preview}</Text>
            <View style={{ marginTop: 8 }}><Reactions like={p.like} comment={p.comment} /></View>
          </View>
        ))}
      </View>
      <TabBar active="board" />
    </MockScreen>
  );
}

function Reactions({ like, comment }) {
  return (
    <View style={[styles.row, { gap: 12 }]}>
      <View style={styles.row}>
        <Ionicons name="heart" size={16} color={colors.like} />
        <Text style={[styles.reactText, { color: colors.like }]}>{like}</Text>
      </View>
      <View style={styles.row}>
        <Ionicons name="chatbubble" size={15} color={colors.comment} />
        <Text style={[styles.reactText, { color: colors.comment }]}>{comment}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. 최초 1회 로그인 — 실제 화면이 아닌 설명 그림 (실제 크기로 그려 축소)
// ─────────────────────────────────────────────────────────────
export function OneTimeLoginMock({ targets = [], afterText = '' }) {
  return (
    <MockScreen>
      <View style={styles.oneTimeWrap}>
        <View style={styles.oneTimeBadge}>
          <Ionicons name="lock-open" size={48} color={colors.white} />
        </View>
        <Text style={styles.oneTimeStep}>最初の1回だけ</Text>
        {targets.map((t) => (
          <View key={t} style={styles.oneTimeRow}>
            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            <Text style={styles.oneTimeRowText}>{t} にログイン</Text>
          </View>
        ))}
        <View style={styles.oneTimeAfter}>
          <Ionicons name="sync" size={20} color={colors.gray500} />
          <Text style={styles.oneTimeAfterText}>{afterText}</Text>
        </View>
      </View>
    </MockScreen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  page: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bigTitle: { fontSize: 26, fontWeight: '800', color: colors.gray900, letterSpacing: -0.5 },

  pillBtn: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  pillBtnText: { ...typography.captionStrong, color: colors.white },

  tabBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 68,
    flexDirection: 'row', backgroundColor: colors.white,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: -2 }, elevation: 8,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { fontSize: 11, fontWeight: '500' },
  tabLabelOn: { fontWeight: '700' },

  // 時間割
  ttHead: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  ttTerm: { ...typography.caption, color: colors.textSecondary, marginBottom: 4 },
  bulkChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryLight,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8,
  },
  bulkChipText: { ...typography.captionStrong, color: colors.primary },
  todayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: 8 },
  todayText: { ...typography.caption, color: colors.gray700 },
  gridCard: { marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 10 },
  dayRow: { flexDirection: 'row', paddingBottom: 8, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  dayText: { flex: 1, textAlign: 'center', ...typography.captionStrong, color: colors.textSecondary },
  periodRow: { flexDirection: 'row', height: 70, marginBottom: 3 },
  periodCol: { width: 36, alignItems: 'center', justifyContent: 'center' },
  periodNum: { ...typography.captionStrong, color: colors.textSecondary },
  periodTime: { fontSize: 10, color: colors.textDisabled, marginTop: 2 },
  cell: { flex: 1, marginHorizontal: 1.5, borderRadius: 8, padding: 4 },
  cellName: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
  cellRoom: { fontSize: 10, marginTop: 2, opacity: 0.85 },

  // 잠금화면 알림
  lock: { flex: 1, backgroundColor: MOCK_BG_LOCK, alignItems: 'center', paddingTop: 30, paddingHorizontal: 12 },
  lockDate: { fontSize: 17, fontWeight: '600', color: colors.gray700 },
  lockTime: { fontSize: 84, fontWeight: '300', color: colors.gray900, letterSpacing: -2, lineHeight: 96 },
  push: {
    flexDirection: 'row', gap: 10, backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 20, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  pushIcon: { width: 36, height: 36, borderRadius: 9 },
  pushTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  pushTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.gray900 },
  pushTime: { fontSize: 12, color: colors.gray500, marginLeft: 6 },
  pushBody: { fontSize: 13.5, lineHeight: 18, color: colors.gray800 },
  banner: { position: 'absolute', top: 6, left: 8, right: 8 },

  // 課題
  chip: { backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  chipOn: { backgroundColor: colors.primary },
  chipText: { ...typography.captionStrong, color: colors.gray700 },
  chipTextOn: { color: colors.white },
  hint: { fontSize: 11, color: colors.textDisabled, textAlign: 'center', marginVertical: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16 },
  cardCourse: { ...typography.caption, color: colors.textSecondary, flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  statusText: { ...typography.captionStrong },
  more: { fontSize: 18, color: colors.textSecondary, fontWeight: '600', letterSpacing: 1, marginLeft: 8 },
  cardTitle: { ...typography.subtitle, color: colors.textPrimary, marginTop: 8, marginBottom: 12 },
  autoBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: -4, marginBottom: 12 },
  autoBadgeText: { ...typography.caption, color: colors.primary },
  cardDue: { ...typography.caption, color: colors.textSecondary, marginLeft: 4 },
  dday: { ...typography.captionStrong },

  // 講義評価
  navHeader: { height: 52, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontWeight: '700', color: colors.gray900 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white,
    borderRadius: 12, marginHorizontal: 16, paddingHorizontal: 14, height: 44, marginBottom: 16,
  },
  searchText: { fontSize: 15, color: colors.gray400 },
  sectionLabel: { ...typography.captionStrong, color: colors.textSecondary, paddingHorizontal: 20, marginBottom: 10 },
  reviewName: { fontSize: 16, fontWeight: '700', color: colors.gray900, flex: 1 },
  stars: { fontSize: 15, color: '#E8890C', letterSpacing: 1 },
  reviewProf: { ...typography.caption, color: colors.textSecondary },
  reviewScore: { fontSize: 16, fontWeight: '700', color: colors.gray900 },
  reviewCount: { fontSize: 12, fontWeight: '400', color: colors.textSecondary },
  hashTag: { backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  hashTagText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  quote: { ...typography.caption, color: colors.gray500, lineHeight: 19 },
  fab: {
    position: 'absolute', right: 16, bottom: 84, backgroundColor: colors.primary,
    borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14,
  },
  fabText: { fontSize: 15, fontWeight: '700', color: colors.white },

  // 掲示板
  boardSection: { fontSize: 15, fontWeight: '700', color: colors.gray900 },
  boardSub: { fontSize: 12, color: colors.textSecondary },
  hotBadge: { backgroundColor: colors.hotSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6 },
  hotText: { fontSize: 11, fontWeight: '800', color: colors.hot },
  anonAvatar: { width: 18, height: 18, borderRadius: 5, backgroundColor: colors.gray200, marginRight: 6 },
  anonText: { fontSize: 13, fontWeight: '600', color: colors.gray600, marginLeft: 2 },
  postTitle: { fontSize: 16, fontWeight: '700', color: colors.gray900 },
  postPreview: { fontSize: 14, color: colors.gray500, marginTop: 4 },
  postRow: { backgroundColor: colors.white, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  catTag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginRight: 6 },
  catTagText: { fontSize: 12, fontWeight: '700' },
  reactText: { fontSize: 14, fontWeight: '600', marginLeft: 4 },

  // 최초 1회 로그인
  oneTimeWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, backgroundColor: colors.white },
  oneTimeBadge: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 22,
  },
  oneTimeStep: { fontSize: 21, fontWeight: '800', color: colors.gray900, marginBottom: 20 },
  oneTimeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.gray50,
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18, marginBottom: 10, width: '100%',
  },
  oneTimeRowText: { fontSize: 17, fontWeight: '700', color: colors.gray800 },
  oneTimeAfter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  oneTimeAfterText: { fontSize: 15, fontWeight: '600', color: colors.gray500 },
});
