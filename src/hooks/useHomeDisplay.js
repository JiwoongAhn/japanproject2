import { useEffect, useState } from 'react';
import { HOME_DISPLAY_DEFAULT, loadHomeDisplay, setHomeDisplay, subscribeHomeDisplay } from '../utils/homeDisplay';

// 반환: [표시 설정, 바꾸기(patch)]
export function useHomeDisplay() {
  const [display, setDisplay] = useState(HOME_DISPLAY_DEFAULT);
  useEffect(() => {
    let alive = true;
    loadHomeDisplay().then((v) => { if (alive) setDisplay(v); });
    const off = subscribeHomeDisplay(setDisplay);
    return () => { alive = false; off(); };
  }, []);
  return [display, setHomeDisplay];
}
