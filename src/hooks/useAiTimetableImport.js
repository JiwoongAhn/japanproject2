// AI 시간표 읽기 공통 흐름 — 서버 호출 → 학기 선택 → 미리보기 화면
//
// 쓰는 곳 3군데: 학교 사이트(페이지 내용) / 시간표 탭(스크린샷) / 붙여넣기 화면(텍스트).
// 로딩 표시는 reading 값으로 AiReadingOverlay 를 띄우면 된다.
import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { requestAiTimetable } from '../utils/aiTimetableClient';
import { countAiTerms, decideTerm, pickTermResult } from '../utils/aiTimetable';
import { getCurrentTerm, termLabel } from '../utils/timetable';

export function useAiTimetableImport({ navigation, universityName }) {
  const [reading, setReading] = useState(false);
  const busyRef = useRef(false); // 버튼 연타로 두 번 호출되지 않게

  const goPreview = useCallback((parsed, term) => {
    navigation.navigate('MainTab', {
      screen: 'Timetable',
      params: {
        screen: 'BulkAddPreview',
        params: { parseResult: pickTermResult(parsed, term), defaultTerm: term },
      },
    });
  }, [navigation]);

  // input: { page } | { text } | { images }
  const run = useCallback(async (input) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setReading(true);
    let result;
    try {
      result = await requestAiTimetable({ ...input, universityName });
    } catch (e) {
      Alert.alert('読み取れませんでした', e.message);
      return;
    } finally {
      busyRef.current = false;
      setReading(false);
    }

    const { parsed } = result;
    if (parsed.length === 0) {
      Alert.alert(
        '授業が見つかりませんでした',
        '時間割（週の表）が表示された画面で、もう一度お試しください。',
      );
      return;
    }

    const counts = countAiTerms(parsed);
    const current = getCurrentTerm();
    const decision = decideTerm(counts, current);
    if (!decision.ask) {
      goPreview(parsed, decision.term);
      return;
    }
    const label = (term) =>
      `${termLabel(term)} (${counts[term] + counts.unknown}件)${term === current ? ' ・今学期' : ''}`;
    Alert.alert(
      '時間割の取り込み',
      `${parsed.length}件の授業が見つかりました。\nどの学期の時間割を取り込みますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: label('spring'), onPress: () => goPreview(parsed, 'spring') },
        { text: label('fall'), onPress: () => goPreview(parsed, 'fall') },
      ],
    );
  }, [universityName, goPreview]);

  return { reading, run };
}
