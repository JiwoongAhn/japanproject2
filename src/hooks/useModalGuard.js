// 창(Modal)이 열리지 못했을 때의 안전장치
//   iOS 는 다른 창이 떠 있거나 닫히는 중이면 새 창을 열지 못하는데, 그러면 "보이지 않는 창"이 화면을 막아
//   스크롤도 버튼도 안 먹는다 (2026-11-25 「新しいバージョン」과 「新しくなりました」 창이 겹쳐 실제로 재현).
//   → 열라고 한 뒤 일정 시간 안에 OS 가 "열렸다"(onShow)고 알려주지 않으면 닫힌 것으로 처리한다.
import { useEffect, useRef } from 'react';
import { motion } from '../constants/motion';

export function useModalGuard(visible, onClose) {
  const shown = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!visible) { shown.current = false; return undefined; }
    const timer = setTimeout(() => { if (!shown.current) close.current?.(); }, motion.modalTimeout);
    return () => clearTimeout(timer);
  }, [visible]);

  return () => { shown.current = true; }; // Modal 의 onShow 에 넘긴다
}
