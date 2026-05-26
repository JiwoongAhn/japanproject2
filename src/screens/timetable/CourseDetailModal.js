import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
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

// 수업 상세 모달 (바텀시트)
// Props:
//   course  — 선택된 수업 객체 (null이면 표시 안 함)
//   onClose — 모달 닫기 함수
//   onDelete(courseId) — 삭제 실행 함수
//   onEdit(course)     — 편집 화면 열기 함수
export default function CourseDetailModal({ course, onClose, onDelete, onEdit }) {
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

        {/* 과목명 + 교수명 */}
        <View style={styles.titleRow}>
          <View style={[styles.colorDot, { backgroundColor: color.accent }]} />
          <View style={styles.titleTexts}>
            <Text style={styles.courseName}>{course.name}</Text>
            {course.professor_name ? (
              <Text style={styles.professorName}>{course.professor_name} 教授</Text>
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
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleEditPress}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonPrimaryText}>✏️ 編集する</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonOutlineDanger]}
              onPress={handleDeletePress}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonOutlineDangerText}>削除する</Text>
            </TouchableOpacity>
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
    paddingBottom: spacing.xxxl + spacing.xs,
    paddingTop: spacing.md,
    ...shadow.card,
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
  buttonPrimary: {
    backgroundColor: colors.primary,
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
