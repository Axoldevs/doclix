import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useAutoSave(
  value: string,
  onSave: (value: string) => Promise<{ error: string | null }>,
  delay = 900
) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedRef = useRef(value);
  const savingValueRef = useRef<string | null>(null);

  const triggerSave = useCallback(
    async (val: string) => {
      if (val === lastSavedRef.current) return;
      setStatus('saving');
      savingValueRef.current = val;
      const { error } = await onSave(val);
      if (savingValueRef.current !== val) return; // superseded by a newer save
      if (error) {
        setStatus('error');
      } else {
        lastSavedRef.current = val;
        setStatus('saved');
      }
    },
    [onSave]
  );

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      triggerSave(value);
    }, delay);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay]);

  const saveNow = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    return triggerSave(value);
  }, [triggerSave, value]);

  return { status, saveNow };
}
