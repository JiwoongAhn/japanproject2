import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';

import { colors, pastel } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import Card from '../../components/Card';
import LoadingDots from '../../components/LoadingDots';
import AppTextInput from '../../components/AppTextInput';
import { supabase } from '../../lib/supabase';
import { buildCourseRows } from '../../utils/timetable';
import { COURSE_COLORS } from '../../constants/courseColors';
import { getSyllabusUrl, buildSyllabusFetchJS, matchRoom } from '../../utils/syllabusRoom';
import { findUniversityByEmail } from '../../utils/university';
import { useAuth } from '../../lib/AuthProvider';

// ─────────────────────────────────────────────────────────────
// [Step 3 목업 스위치]
//   true  → 실제 시라바스 조회 대신 가짜 진행률로 "教室を取得中" 오버레이만 확인
//            (Expo Go·웹에서 WebView가 안 돌아가므로 UI 방향성 먼저 검증)
//   false → 숨은 WebView로 실제 시라바스 조회 (실기기 빌드/OTA에서 검증)
//   ⚠️ UI 승인 후 false로 바꾸면 바로 실동작.
const MOCK_ROOM_FETCH = false;
// 목업이 채워넣을 가짜 교실들 (일부 null = 집중강의처럼 교실 없는 경우 재현)
const MOCK_ROOMS = ['30303', '12203演習室', '30403', '11202', null, '20101', '13305'];
const MOCK_STEP_MS = 600; // 한 과목당 진행 간격

// 요일별 파스텔 매핑 — 한 화면에서 5±2색 이내 유지
const DAY_PASTEL = ['mint', 'peach', 'sky', 'lavender', 'yellow', 'pink'];
const DAY_LABEL = ['月', '火', '水', '木', '金', '土'];
// 편집 모달의 요일 선택지 — courses는 月~金(0~4)만 허용
const EDIT_DAYS = [0, 1, 2, 3, 4];
const EDIT_PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

function getDayPastel(day) {
  return DAY_PASTEL[day] ?? 'rose';
}

function getDayLabel(day) {
  return DAY_LABEL[day] ?? '?';
}

export default function BulkAddPreviewScreen({ navigation, route }) {
  const parseResult = route?.params?.parseResult ?? { parsed: [], unparsed: [] };
  const defaultTerm = route?.params?.defaultTerm ?? 'spring';

  // 미리보기 항목 — 편집/추가가 가능하도록 state로 관리
  // 각 과목에 colorIndex를 자동 배정(서로 다른 색이 순환되도록) → 사용자가 탭으로 변경 가능
  const [items, setItems] = useState(() =>
    (parseResult.parsed ?? []).map((it, i) => ({
      ...it,
      colorIndex: i % COURSE_COLORS.length,
    }))
  );
  // 기본 선택: confidence='high'(요일·교시 확실)인 항목 모두 체크
  const [selected, setSelected] = useState(() => {
    const set = new Set();
    (parseResult.parsed ?? []).forEach((item, idx) => {
      if (item.confidence === 'high') set.add(idx);
    });
    return set;
  });
  const [saving, setSaving] = useState(false);
  // 편집 모달 상태 — null이면 닫힘. index===-1이면 신규 추가
  const [editing, setEditing] = useState(null);
  // 색상 팔레트가 펼쳐진 카드 index — null이면 모두 닫힘
  const [colorPickerIdx, setColorPickerIdx] = useState(null);

  // ── 시라바스 교실 조회 (Step 3) ─────────────────────────────
  // 내 학교가 교실 자동 조회를 지원하는지 먼저 판정한다.
  // 미지원 학교에서 조회를 돌리면 남의 대학(국사관) 시라바스 서버로 검색 요청이
  // 나가므로, URL이 없으면(null) 조회 자체를 시작하지 않는다.
  const { session } = useAuth();
  const syllabusUrl = useMemo(
    () => getSyllabusUrl(findUniversityByEmail(session?.user?.email)?.id),
    [session?.user?.email]
  );

  // roomPhase: idle → loading → done | error  (skipped = 미지원 학교라 조회 안 함)
  const [roomPhase, setRoomPhase] = useState('idle');
  const [roomDone, setRoomDone] = useState(0);   // 조회 완료 과목 수
  const [roomTotal, setRoomTotal] = useState(0); // 조회 대상 과목 수
  const roomWebRef = useRef(null);
  const roomStartedRef = useRef(false);   // 조회 1회만 시작
  const roomInjectedRef = useRef(false);  // WebView 로드 후 주입 1회만

  // 조회 대상: 이름이 있는 과목 전부. index는 items 배열 위치 → 결과를 그 자리에 채움.
  // 최초 파싱 결과 기준으로 1회만 계산(사용자 편집 전에 조회가 돌기 때문).
  const roomQueries = useMemo(
    () =>
      (parseResult.parsed ?? [])
        .map((it, index) => ({ index, name: (it?.name || '').trim() }))
        .filter((q) => q.name),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // 화면 진입 시 1회 교실 조회 시작
  useEffect(() => {
    if (roomStartedRef.current) return;
    // 교실 조회를 지원하지 않는 학교는 조회를 건너뛴다.
    // (기능 중단이 아니라 조용한 생략 — 교실 없이 시간표는 정상 추가된다)
    if (!MOCK_ROOM_FETCH && !syllabusUrl) {
      roomStartedRef.current = true;
      setRoomPhase('skipped');
      return;
    }
    if (roomQueries.length === 0) {
      setRoomPhase('done');
      return;
    }
    roomStartedRef.current = true;
    setRoomTotal(roomQueries.length);
    setRoomPhase('loading');

    if (MOCK_ROOM_FETCH) {
      // [목업] 실제 조회 대신 0.6초마다 한 과목씩 가짜 교실을 채운다.
      let i = 0;
      const timer = setInterval(() => {
        const q = roomQueries[i];
        const fakeRoom = MOCK_ROOMS[i % MOCK_ROOMS.length];
        if (fakeRoom) {
          setItems((prev) =>
            prev.map((it, idx) => (idx === q.index ? { ...it, room: fakeRoom } : it))
          );
        }
        i += 1;
        setRoomDone(i);
        if (i >= roomQueries.length) {
          clearInterval(timer);
          setRoomPhase('done');
        }
      }, MOCK_STEP_MS);
      return () => clearInterval(timer);
    }
    // 실동작(MOCK_ROOM_FETCH=false)은 숨은 WebView가 onLoadEnd에서 주입 → handleRoomMessage로 진행.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomQueries, syllabusUrl]);

  // 숨은 WebView → RN 메시지: phase별로 진행률·교실 반영
  const handleRoomMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type !== 'syllabusRoom') return;
      if (msg.phase === 'start') {
        if (typeof msg.total === 'number') setRoomTotal(msg.total);
      } else if (msg.phase === 'item') {
        // 검색결과 행 → matchRoom으로 이 과목의 교실 확정(없으면 그대로 둠)
        setItems((prev) =>
          prev.map((it, idx) => {
            if (idx !== msg.index) return it;
            const room = matchRoom(it, msg.rows || []);
            return room ? { ...it, room } : it;
          })
        );
        setRoomDone((d) => d + 1);
      } else if (msg.phase === 'itemError') {
        setRoomDone((d) => d + 1); // 개별 실패는 건너뛰고 진행률만 올림
      } else if (msg.phase === 'done') {
        setRoomPhase('done');
      } else if (msg.phase === 'error') {
        setRoomPhase('error');
      }
    } catch (_) {}
  };

  const toggle = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // 색 동그라미 탭 → 해당 카드의 팔레트 열기/닫기 토글
  const toggleColorPicker = (idx) => {
    setColorPickerIdx((prev) => (prev === idx ? null : idx));
  };

  // 팔레트에서 색 선택 → 해당 과목의 colorIndex 변경 후 팔레트 닫기
  const setItemColor = (idx, colorIndex) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, colorIndex } : it)));
    setColorPickerIdx(null);
  };

  const selectedCount = selected.size;

  // ── 편집/추가 ──────────────────────────────
  const openEdit = (idx) => {
    const it = items[idx];
    setEditing({ index: idx, name: it.name ?? '', day: it.day ?? null, period: it.period ?? null, room: it.room ?? '' });
  };

  const openAdd = () => {
    setEditing({ index: -1, name: '', day: null, period: null, room: '' });
  };

  const closeEdit = () => setEditing(null);

  const saveEdit = () => {
    const name = (editing.name ?? '').trim();
    if (!name) {
      Alert.alert('お知らせ', '科目名を入力してください');
      return;
    }
    const { index, day, period } = editing;
    const room = (editing.room ?? '').trim() || null; // 빈칸이면 null
    // 요일·교시가 모두 채워지면 신뢰도 high(자동 체크 대상)
    const confidence = (day != null && period != null) ? 'high' : 'low';

    if (index === -1) {
      // 신규 추가 — 새 항목은 자동으로 체크 + 색상 자동 배정
      const newIdx = items.length;
      setItems((prev) => [
        ...prev,
        { name, day, period, room, term: defaultTerm, professor: null, confidence, colorIndex: newIdx % COURSE_COLORS.length },
      ]);
      setSelected((prev) => new Set(prev).add(newIdx));
    } else {
      // 기존 항목 수정 — 교수/학기 등 기존 값 보존
      setItems((prev) => prev.map((it, i) => (i === index ? { ...it, name, day, period, room, confidence } : it)));
      if (confidence === 'high') setSelected((prev) => new Set(prev).add(index));
    }
    setEditing(null);
  };

  const handleConfirm = async () => {
    if (selectedCount === 0 || saving) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('お知らせ', 'ログインが必要です');
        setSaving(false);
        return;
      }

      // 체크된 항목만 추출
      const selectedItems = items.filter((_, idx) => selected.has(idx));

      // 기존 시간표를 불러와 중복 칸(같은 요일+교시) 검사에 사용
      const { data: existing, error: fetchError } = await supabase
        .from('courses')
        .select('day_of_week, period')
        .eq('user_id', user.id);

      if (fetchError) {
        Alert.alert('お知らせ', '時間割の確認に失敗しました。もう一度お試しください');
        setSaving(false);
        return;
      }

      // 파서 항목 → DB 행으로 변환 (불가·중복 항목은 skipped로 분리)
      const { rows, skipped } = buildCourseRows(selectedItems, user.id, existing || []);

      if (rows.length === 0) {
        setSaving(false);
        // 추가할 새 수업이 없음(이미 전부 등록됨/정보 부족) → 막다른 OK 대신
        // "원래 화면으로 돌아가시겠습니까?" 확인 → 시간표 첫 화면으로 복귀
        Alert.alert(
          '追加できる授業がありません',
          'すべての授業がすでに時間割に登録されています。\n元の画面に戻りますか?',
          [
            { text: 'キャンセル', style: 'cancel' },
            { text: '元の画面に戻る', onPress: () => navigation.popToTop() },
          ]
        );
        return;
      }

      const { error: insertError } = await supabase.from('courses').insert(rows);

      if (insertError) {
        Alert.alert('お知らせ', '授業をうまく保存できませんでした。もう一度お試しください');
        setSaving(false);
        return;
      }

      // 성공 — 건너뛴 항목이 있으면 함께 안내한 뒤 시간표로 복귀
      const message = skipped.length > 0
        ? `${rows.length}件を追加しました\n（${skipped.length}件は重複・情報不足のためスキップ）`
        : `${rows.length}件を追加しました`;

      Alert.alert('完了', message, [
        // popToTop: 입력·미리보기 화면을 모두 닫고 시간표 첫 화면으로 한 번에 복귀
        { text: 'OK', onPress: () => navigation.popToTop() },
      ]);
    } catch (e) {
      Alert.alert('お知らせ', '予期せぬエラーが発生しました。もう一度お試しください');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ── 헤더 ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.headerBack}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>確認 ({selectedCount}件)</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item, idx) => {
          const isLow = item.confidence === 'low';
          const isSelected = selected.has(idx);
          const hasSlot = item.day != null && item.period != null;
          const dayPastelKey = item.day != null ? getDayPastel(item.day) : 'rose';
          const dayBg = pastel[dayPastelKey]?.bg ?? colors.gray100;
          const dayAccent = pastel[dayPastelKey]?.accent ?? colors.textSecondary;

          return (
            <View key={idx} style={{ marginBottom: spacing.sm }}>
              <Card pastel={isLow ? 'rose' : undefined} padding="lg">
                <View style={styles.row}>
                  {/* 체크박스 */}
                  <TouchableOpacity
                    onPress={() => toggle(idx)}
                    activeOpacity={0.7}
                    style={styles.checkboxTouch}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                      {isSelected ? <Text style={styles.checkboxMark}>✓</Text> : null}
                    </View>
                  </TouchableOpacity>

                  {/* 본문 — 탭하면 편집 */}
                  <TouchableOpacity
                    style={styles.body}
                    activeOpacity={0.7}
                    onPress={() => openEdit(idx)}
                  >
                    {/* 요일·교시 배지 라인 */}
                    <View style={styles.badgeRow}>
                      {hasSlot ? (
                        <>
                          <View style={[styles.dayBadge, { backgroundColor: dayBg }]}>
                            <Text style={[styles.dayBadgeText, { color: dayAccent }]}>
                              {getDayLabel(item.day)}
                            </Text>
                          </View>
                          <Text style={styles.periodLabel}>{item.period}限目</Text>
                        </>
                      ) : (
                        <View style={[styles.dayBadge, { backgroundColor: colors.gray100 }]}>
                          <Text style={[styles.dayBadgeText, { color: colors.textSecondary }]}>
                            未割当
                          </Text>
                        </View>
                      )}

                      <Text style={[styles.editHint, isLow && styles.editHintWarn]}>
                        {isLow ? '⚠ タップで修正' : '✎ 編集'}
                      </Text>
                    </View>

                    {/* 과목명 */}
                    <Text style={styles.courseName} numberOfLines={2}>
                      {item.name}
                    </Text>

                    {/* 교수명 + 교실 */}
                    {(item.professor || item.room) ? (
                      <View style={styles.metaRow}>
                        {item.professor ? <Text style={styles.metaText}>{item.professor}</Text> : null}
                        {item.room ? (
                          <View style={styles.roomBadge}>
                            <Text style={styles.roomBadgeText}>📍 {item.room}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </TouchableOpacity>

                  {/* 현재 색 동그라미 — 탭하면 팔레트 펼침 */}
                  <TouchableOpacity
                    onPress={() => toggleColorPicker(idx)}
                    activeOpacity={0.7}
                    style={styles.colorTrigger}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <View
                      style={[
                        styles.currentColorDot,
                        {
                          backgroundColor: COURSE_COLORS[item.colorIndex]?.bg ?? colors.gray100,
                          borderColor: COURSE_COLORS[item.colorIndex]?.accent ?? colors.gray300,
                        },
                      ]}
                    />
                  </TouchableOpacity>
                </View>

                {/* 색상 팔레트 — 이 카드가 선택됐을 때만 펼침 */}
                {colorPickerIdx === idx ? (
                  <View style={styles.palette}>
                    {COURSE_COLORS.map((color, ci) => {
                      const on = item.colorIndex === ci;
                      return (
                        <TouchableOpacity
                          key={ci}
                          style={[
                            styles.paletteDot,
                            { backgroundColor: color.bg, borderColor: on ? color.accent : 'transparent' },
                          ]}
                          onPress={() => setItemColor(idx, ci)}
                          activeOpacity={0.8}
                        >
                          {on ? <Text style={[styles.paletteCheck, { color: color.accent }]}>✓</Text> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </Card>
            </View>
          );
        })}

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>解析できる授業がありませんでした</Text>
          </View>
        ) : null}

        {/* 수동 추가 */}
        <TouchableOpacity style={styles.addManualBtn} onPress={openAdd} activeOpacity={0.8}>
          <Text style={styles.addManualText}>＋ 手動で追加</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── 하단 fixed ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={handleConfirm}
          activeOpacity={0.85}
          disabled={selectedCount === 0 || saving}
          style={[
            styles.primaryButton,
            (selectedCount === 0 || saving) && styles.primaryButtonDisabled,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {saving ? '追加中...' : `${selectedCount}件を時間割に追加する`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── 시라바스 교실 조회 (Step 3) ── */}
      {/* 숨은 WebView: 실동작 시에만. 화면 밖(1x1, 투명)에서 fetch로 조회만 수행 */}
      {/* syllabusUrl이 없는 학교에서는 이 WebView가 아예 렌더되지 않는다 */}
      {!MOCK_ROOM_FETCH && roomPhase === 'loading' && syllabusUrl ? (
        <WebView
          ref={roomWebRef}
          source={{ uri: syllabusUrl }}
          style={styles.hiddenWeb}
          onMessage={handleRoomMessage}
          onLoadEnd={() => {
            if (roomInjectedRef.current) return; // 로드 완료가 여러 번 와도 1회만 주입
            roomInjectedRef.current = true;
            roomWebRef.current?.injectJavaScript(buildSyllabusFetchJS(roomQueries));
          }}
          onError={() => setRoomPhase('error')}
          javaScriptEnabled
          domStorageEnabled
        />
      ) : null}

      {/* 진행 오버레이: 조회 중일 때 화면을 덮어 "教室を取得中 n/total" 표시 */}
      {roomPhase === 'loading' ? (
        <View style={styles.roomOverlay}>
          <View style={styles.roomOverlayCard}>
            <LoadingDots size={14} style={{ marginBottom: spacing.xs }} />
            <Text style={styles.roomOverlayTitle}>教室を取得中…</Text>
            <Text style={styles.roomOverlayCount}>
              {roomDone} / {roomTotal}
            </Text>
            <Text style={styles.roomOverlayHint}>
              シラバスから教室情報を読み込んでいます
            </Text>
            {/* 서버가 느릴 때 교실 없이 바로 진행 */}
            <TouchableOpacity
              onPress={() => setRoomPhase('done')}
              activeOpacity={0.7}
              style={styles.roomSkipBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.roomSkipText}>スキップして続ける</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* ── 편집/추가 모달 ── */}
      <Modal
        visible={editing !== null}
        transparent
        animationType="slide"
        onRequestClose={closeEdit}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editing?.index === -1 ? '授業を追加' : '授業を編集'}
            </Text>

            <Text style={styles.modalLabel}>科目名</Text>
            <AppTextInput
              style={styles.modalInput}
              value={editing?.name ?? ''}
              onChangeText={(t) => setEditing((e) => ({ ...e, name: t }))}
              placeholder="例: 経営学概論"
              placeholderTextColor={colors.textDisabled}
              maxLength={30}
            />

            <Text style={styles.modalLabel}>教室（任意）</Text>
            <AppTextInput
              style={styles.modalInput}
              value={editing?.room ?? ''}
              onChangeText={(t) => setEditing((e) => ({ ...e, room: t }))}
              placeholder="例: 30303"
              placeholderTextColor={colors.textDisabled}
              maxLength={20}
            />

            <Text style={styles.modalLabel}>曜日</Text>
            <View style={styles.chipWrap}>
              {EDIT_DAYS.map((d) => {
                const active = editing?.day === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setEditing((e) => ({ ...e, day: d }))}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {DAY_LABEL[d]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.modalLabel}>時限</Text>
            <View style={styles.chipWrap}>
              {EDIT_PERIODS.map((p) => {
                const active = editing?.period === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setEditing((e) => ({ ...e, period: p }))}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {p}限
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={closeEdit} activeOpacity={0.8}>
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={saveEdit} activeOpacity={0.85}>
                <Text style={styles.modalSaveText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // 헤더
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headerBack: {
    ...typography.body2,
    color: colors.textSecondary,
    minWidth: 64,
  },
  headerTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  headerRight: {
    minWidth: 64,
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // 행 레이아웃
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxTouch: {
    paddingRight: spacing.md,
    paddingTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.gray300,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxMark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },

  body: {
    flex: 1,
  },

  // 배지 라인
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  dayBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  dayBadgeText: {
    ...typography.captionStrong,
  },
  periodLabel: {
    ...typography.captionStrong,
    color: colors.textSecondary,
  },
  editHint: {
    ...typography.micro,
    color: colors.textDisabled,
    marginLeft: 'auto',
  },
  editHintWarn: {
    color: pastel.rose.accent,
  },

  // 색상 — 트리거 동그라미 + 펼침 팔레트
  colorTrigger: {
    paddingLeft: spacing.sm,
    paddingTop: 2,
    justifyContent: 'center',
  },
  currentColorDot: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  paletteDot: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteCheck: {
    ...typography.captionStrong,
    fontWeight: '800',
  },

  // 과목명·메타
  courseName: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  // 교실 배지 — 시라바스에서 채워지면 표시
  roomBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: pastel.mint?.bg ?? colors.gray100,
  },
  roomBadgeText: {
    ...typography.captionStrong,
    color: pastel.mint?.accent ?? colors.textSecondary,
  },

  // 숨은 WebView — 화면 밖 1x1 투명(조회 전용, 사용자에겐 안 보임)
  hiddenWeb: {
    position: 'absolute',
    width: 1,
    height: 1,
    top: -1000,
    left: -1000,
    opacity: 0,
  },

  // 교실 조회 진행 오버레이
  roomOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  roomOverlayCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.huge,
    alignItems: 'center',
    minWidth: 220,
  },
  roomOverlayTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  roomOverlayCount: {
    ...typography.title2,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  roomOverlayHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  roomSkipBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  roomSkipText: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },

  // 빈 상태
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.huge,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.body2,
    color: colors.textSecondary,
  },

  // 수동 추가 버튼
  addManualBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addManualText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },

  // 하단 바
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  primaryButtonText: {
    ...typography.subtitle,
    color: colors.white,
  },

  // ── 편집 모달 ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    paddingBottom: spacing.huge,
  },
  modalTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  modalLabel: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  modalInput: {
    ...typography.body1,
    color: colors.textPrimary,
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.gray50,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.white,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
    alignItems: 'center',
  },
  modalCancelText: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalSaveText: {
    ...typography.bodyStrong,
    color: colors.white,
  },
});
