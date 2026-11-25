// 확인 창을 띄우는 훅
//   const { confirm, confirmElement } = useConfirm();            // 일반 화면 → 아래에서
//   const { confirm, confirmElement } = useConfirm('center');    // 이미 올라온 창(modal 화면) 안 → 가운데에서
//   confirm({ kind: 'danger', title, target, message, confirmText, onConfirm }); 화면 끝에 {confirmElement} 를 넣는다
// 앱 전체에 하나만 두지 않고 화면마다 두는 이유: modal 로 열린 화면 위에는 루트의 창이 뜨지 않는다(iOS)
import React, { useCallback, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import { motion } from '../constants/motion';

export function useConfirm(placement = 'sheet') {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState(null);

  const confirm = useCallback((next) => {
    setOptions(next);
    setVisible(true);
  }, []);
  const close = useCallback(() => setVisible(false), []);

  const handleConfirm = () => {
    setVisible(false);
    const run = options?.onConfirm;
    if (run) setTimeout(run, motion.afterConfirm);
  };

  const confirmElement = (
    <ConfirmDialog visible={visible} placement={placement} options={options} onCancel={close} onConfirm={handleConfirm} />
  );
  return { confirm, confirmElement };
}
