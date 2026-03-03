import { useCallback, useState } from 'react';

const STORAGE_KEY = 'vp_dismissed_hints';

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function useHints() {
  const [dismissed, setDismissed] = useState(getDismissed);

  const shouldShow = useCallback(
    (hintId: string) => !dismissed.has(hintId),
    [dismissed],
  );

  const dismiss = useCallback((hintId: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(hintId);
      saveDismissed(next);
      return next;
    });
  }, []);

  const dismissAll = useCallback(() => {
    setDismissed(prev => {
      saveDismissed(prev);
      return prev;
    });
  }, []);

  return { shouldShow, dismiss, dismissAll };
}
