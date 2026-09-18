import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { colors } from '../../constants/colors';
import { spacing, radius, shadow } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { getCourseColorFor } from '../../constants/courseColors';

// 요일 레이블 (일본어)
const DAY_LABELS = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日'];

// 교시별 시간 (국사관대학 기준)
const PERIOD_TIMES = {
  1: '9:00 ~ 10:30',
  2: '10:45 ~ 12:15',
  3: '12:55 ~ 14:25',
  4: '14:40 ~ 16:10',
  5: '16:25 ~ 17:55',
  6: '18:10 ~ 19:40',
  7: '19:55 ~ 21:25',
  8: '21:40 ~ 23:10',
};

// 欠席/遅刻 카운터 한 줄 (라벨 + −/숫자/+ 스테퍼)
function AttendanceRow({ label, count, accent, onMinus, onPlus }) {
  return (
    <View style={styles.attendanceRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={[styles.stepBtn, count === 0 && styles.stepBtnDisabled]}
          onPress={onMinus}
          disabled={count === 0}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.stepBtnText, count === 0 && styles.stepBtnTextDisabled]}>−</Text>
        </TouchableOpacity>
        <Text style={[styles.stepCount, count > 0 && { color: accent }]}>{count}</Text>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={onPlus}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.stepBtnText}>＋</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// 수업 상세 모달 (바텀시트)
// Props:
//   course  — 선택된 수업 객체 (null이면 표시 안 함)
//   onClose — 모달 닫기 함수
//   onDelete(courseId) — 삭제 실행 함수
//   onEdit(course)     — 편집 화면 열기 함수
//   onAttendanceChange(course, field, delta) — 欠席/遅刻 카운터 증감 (field: 'absent_count' | 'late_count')
//   syllabusUrl        — 학교 시라바스 URL (없으면 シラバス 버튼 숨김)
//   onOpenSyllabus(course) — (선택) 과목별 시라바스를 여는 함수. 있으면 syllabusUrl 대신 이걸 호출
//                            (kaede-i 학교: MY時間割 WebView에서 해당 과목 링크를 자동 클릭)
//   onAddAssignment(course) — 이 수업 이름이 채워진 과제 추가 화면 열기
export default function CourseDetailModal({
  course, onClose, onDelete, onEdit, onAttendanceChange, syllabusUrl, onOpenSyllabus, onAddAssignment,
}) {
  // 삭제 확인 단계 (true면 "정말 삭제?" UI 표시)
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 다른 수업으로 교체될 때 confirmDelete 상태 초기화
  useEffect(() => {
    if (course) {
      setConfirmDelete(false);
    }
  }, [course]);

  if (!course) return null;

  const color = getCourseColorFor(course);
  const dayLabel = DAY_LABELS[course.day_of_week] ?? '不明';
  const timeLabel = PERIOD_TIMES[course.period] ?? '';

  const handleEditPress = () => {
    onClose();        // 모달을 닫고
    onEdit(course);   // 편집 화면으로 이동
  };
  const handleDeletePress = () => setConfirmDelete(true);
  // 과목별 열기(onOpenSyllabus)가 있으면 모달을 닫고 그쪽으로. 없으면 학교 Top 페이지를 인앱 브라우저로
  const handleSyllabusPress = () => {
    if (onOpenSyllabus) {
      onClose();
      onOpenSyllabus(course);
      return;
    }
    if (!syllabusUrl) return;
    WebBrowser.openBrowserAsync(syllabusUrl, {
      toolbarColor: colors.primary,
      controlsColor: '#FFFFFF',
    });
  };
  const handleAddAssignmentPress = () => {
    onClose();
    onAddAssignment?.(course);
  };
  const handleDeleteConfirm = () => {
    onDelete(course.id);
    setConfirmDelete(false);
  };
  const handleDeleteCancel = () => setConfirmDelete(false);
  const handleClose = () => {
    setConfirmDelete(false);
    onClose();
  };

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* 반투명 배경 — 탭하면 닫힘 */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      />

      {/* 하단 시트 */}
      <View style={styles.sheet}>
        {/* 드래그 핸들 바 */}
        <View style={styles.handle} />

        {/* 작은 화면(SE 등)에서 시트가 화면보다 길어지면 정보·출결 부분만 스크롤 (핸들·버튼은 고정) */}
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetScrollInner}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
        {/* 과목명 + 교수명 */}
        <View style={styles.titleRow}>
          <View style={[styles.colorDot, { backgroundColor: color.accent }]} />
          <View style={styles.titleTexts}>
            <Text style={styles.courseName} numberOfLines={2}>{course.name}</Text>
            {course.professor_name ? (
              <Text style={styles.professorName} numberOfLines={1}>{course.professor_name} 教授</Text>
            ) : null}
          </View>
        </View>

        {/* 수업 정보 카드 */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>曜日</Text>
            <Text style={styles.infoValue}>{dayLabel}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>時限</Text>
            <Text style={styles.infoValue}>{course.period}限</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>時間帯</Text>
            <Text style={styles.infoValue}>{timeLabel}</Text>
          </View>
          {course.room ? (
            <>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>教室</Text>
                <Text style={styles.infoValue}>{course.room}</Text>
              </View>
            </>
          ) : null}
          {course.memo ? (
            <>
              <View style={styles.infoDivider} />
              <View style={styles.memoRow}>
                <Text style={styles.infoLabel}>メモ</Text>
                <Text style={styles.memoValue}>{course.memo}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* 出欠カウンター — 欠席/遅刻을 탭으로 증감 (삭제 확인 중에는 숨김) */}
        {!confirmDelete ? (
          <View style={styles.attendanceCard}>
            <AttendanceRow
              label="欠席"
              count={course.absent_count ?? 0}
              accent={colors.danger}
              onMinus={() => onAttendanceChange?.(course, 'absent_count', -1)}
              onPlus={() => onAttendanceChange?.(course, 'absent_count', +1)}
            />
            <View style={styles.infoDivider} />
            <AttendanceRow
              label="遅刻"
              count={course.late_count ?? 0}
              accent={colors.warning}
              onMinus={() => onAttendanceChange?.(course, 'late_count', -1)}
              onPlus={() => onAttendanceChange?.(course, 'late_count', +1)}
            />
          </View>
        ) : null}

        </ScrollView>

        {/* 버튼 블록 — 시트 하단 고정(스크롤 밖). 작은 화면에서도 항상 보인다 */}
        <View style={styles.actions}>
        {/* 삭제 확인 단계 */}
        {confirmDelete ? (
          <>
            <Text style={styles.confirmText}>本当に削除しますか？</Text>
            <TouchableOpacity
              style={[styles.button, styles.buttonDanger]}
              onPress={handleDeleteConfirm}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonDangerText}>削除する</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonGhost]}
              onPress={handleDeleteCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonGhostText}>やっぱりやめる</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* 1줄: 주요 동작 — 編集 / シラバス(학교 URL 있을 때만) */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary, styles.buttonHalf]}
                onPress={handleEditPress}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonPrimaryText}>✏️ 編集する</Text>
              </TouchableOpacity>
              {syllabusUrl || onOpenSyllabus ? (
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary, styles.buttonHalf]}
                  onPress={handleSyllabusPress}
                  activeOpacity={0.85}
                >
                  <Text style={styles.buttonSecondaryText}>📖 シラバス</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {/* 2줄: 보조 동작 — 課題追加 / 削除 */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary, styles.buttonHalf]}
                onPress={handleAddAssignmentPress}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonSecondaryText}>📝 課題を追加</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonOutlineDanger, styles.buttonHalf]}
                onPress={handleDeletePress}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonOutlineDangerText}>削除する</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.button, styles.buttonGhost]}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonGhostText}>キャンセル</Text>
            </TouchableOpacity>
          </>
        )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },

  // 하단 시트 — radius.xxl 적용 (토스 바텀시트)
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    maxHeight: '88%', // 세로가 짧은 기기에서 시트가 화면 위로 넘치지 않게
    ...shadow.card,
  },
  sheetScroll: {
    flexShrink: 1, // maxHeight 안에서 버튼 블록 높이를 뺀 만큼만 차지
  },
  sheetScrollInner: {
    paddingBottom: spacing.xs,
  },
  actions: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },

  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.gray200,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },

  // ── 과목명 행 ──
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.md,
  },
  titleTexts: {
    flex: 1,
  },
  courseName: {
    ...typography.title3,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  professorName: {
    ...typography.body2,
    color: colors.textSecondary,
  },

  // ── 정보 카드 ──
  infoCard: {
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.gray100,
  },
  infoLabel: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  // 메모 — 길어질 수 있어 줄바꿈 허용 (라벨 위, 값 아래 정렬)
  memoRow: {
    paddingVertical: spacing.md,
  },
  memoValue: {
    ...typography.body2,
    color: colors.textPrimary,
    marginTop: spacing.xs,
    lineHeight: 20,
  },

  // ── 出欠カウンター ──
  attendanceCard: {
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  attendanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  stepBtnDisabled: {
    backgroundColor: colors.gray100,
    shadowOpacity: 0,
    elevation: 0,
  },
  stepBtnText: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  stepBtnTextDisabled: {
    color: colors.gray200,
  },
  stepCount: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    minWidth: 34,
    textAlign: 'center',
  },

  // ── 삭제 확인 ──
  confirmText: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  // ── 버튼 공통 ──
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
    height: 56,
    justifyContent: 'center',
  },
  // 2열 배치 — 시트 폭을 반씩 나눠 쓴다 (gap 은 buttonRow 에서)
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  buttonHalf: {
    flex: 1,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  // 연한 파랑 배경의 보조 버튼 (シラバス·課題追加)
  buttonSecondary: {
    backgroundColor: colors.primaryLight,
  },
  buttonSecondaryText: {
    ...typography.subtitle,
    color: colors.primary,
    fontWeight: '700',
  },
  buttonPrimaryText: {
    ...typography.subtitle,
    color: colors.white,
    fontWeight: '700',
  },
  buttonOutlineDanger: {
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: colors.dangerSoft,
  },
  buttonOutlineDangerText: {
    ...typography.subtitle,
    color: colors.danger,
  },
  buttonDanger: {
    backgroundColor: colors.danger,
  },
  buttonDangerText: {
    ...typography.subtitle,
    color: colors.white,
    fontWeight: '700',
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonGhostText: {
    ...typography.body2,
    color: colors.textSecondary,
  },
});
