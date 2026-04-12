import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors } from '../../constants/colors';
import { getCourseColor } from '../../constants/courseColors';

// 요일 레이블 (일본어)
const DAY_LABELS = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日'];

// 교시별 시간 (국사관대학 기준: 1.5h 수업, 15분 휴식, 점심 12:15~12:55)
// 형식: '시작~종료'
const PERIOD_TIMES = {
  1: '9:00~10:30',
  2: '10:45~12:15',
  3: '12:55~14:25',
  4: '14:40~16:10',
  5: '16:25~17:55',
  6: '18:10~19:40',
  7: '19:55~21:25',
  8: '21:40~23:10',
};

// 수업 상세 모달
// Props:
//   course  — 선택된 수업 객체 (null이면 표시 안 함)
//   onClose — 모달 닫기 함수
//   onDelete(courseId) — 삭제 실행 함수
export default function CourseDetailModal({ course, onClose, onDelete }) {
  // 삭제 확인 단계 (true면 "정말 삭제?" UI 표시)
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 다른 수업으로 교체될 때 confirmDelete 상태 초기화
  // (컴포넌트는 언마운트되지 않으므로 useEffect로 초기화 필요)
  useEffect(() => {
    if (course) {
      setConfirmDelete(false);
    }
  }, [course]);

  if (!course) return null;

  const color = getCourseColor(course.id);
  const dayLabel = DAY_LABELS[course.day_of_week] ?? '不明';
  const timeLabel = PERIOD_TIMES[course.period] ?? '';

  // 삭제 버튼 첫 번째 탭: 확인 단계로 전환
  const handleDeletePress = () => {
    setConfirmDelete(true);
  };

  // 삭제 최종 확인: 실제 삭제 실행
  const handleDeleteConfirm = () => {
    onDelete(course.id);
    setConfirmDelete(false);
  };

  // 삭제 취소: 확인 단계 해제
  const handleDeleteCancel = () => {
    setConfirmDelete(false);
  };

  // 모달 닫기 시 confirmDelete 상태도 초기화
  const handleClose = () => {
    setConfirmDelete(false);
    onClose();
  };

  return (
    // 전체 화면을 덮는 오버레이 (웹/네이티브 모두 호환)
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
          {/* 색상 원 */}
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
        </View>

        {/* 삭제 확인 단계 */}
        {confirmDelete ? (
          <>
            <Text style={styles.confirmText}>本当に削除しますか？</Text>
            <TouchableOpacity
              style={[styles.button, styles.buttonDanger]}
              onPress={handleDeleteConfirm}
            >
              <Text style={styles.buttonDangerText}>削除する</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonGhost]}
              onPress={handleDeleteCancel}
            >
              <Text style={styles.buttonGhostText}>やっぱりやめる</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.button, styles.buttonOutlineDanger]}
              onPress={handleDeletePress}
            >
              <Text style={styles.buttonOutlineDangerText}>削除する</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonGhost]}
              onPress={handleClose}
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
  // 반투명 전체 배경
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },

  // 하단 시트 컨테이너
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
  },

  // 드래그 핸들 바
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },

  // 과목명 행
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  titleTexts: {
    flex: 1,
  },
  courseName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  professorName: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  // 정보 카드
  infoCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // 삭제 확인 문구
  confirmText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },

  // 버튼 공통
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },

  // 아웃라인 danger 버튼 (첫 번째 삭제 탭)
  buttonOutlineDanger: {
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: 'transparent',
  },
  buttonOutlineDangerText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.danger,
  },

  // 실제 danger 버튼 (확인 단계)
  buttonDanger: {
    backgroundColor: colors.danger,
  },
  buttonDangerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ghost 버튼 (취소)
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonGhostText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
});
