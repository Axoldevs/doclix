import { useCallback, useRef, useState } from 'react';

export function useHistory(initial: string) {
  const [value, setValueState] = useState(initial);
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const lastPushedAt = useRef<number>(Date.now());

  const setValue = useCallback(
    (next: string) => {
      const now = Date.now();
      // Coalesce rapid keystrokes into fewer history entries (every 500ms)
      if (now - lastPushedAt.current > 500) {
        undoStack.current.push(value);
        if (undoStack.current.length > 100) undoStack.current.shift();
        redoStack.current = [];
        lastPushedAt.current = now;
      }
      setValueState(next);
    },
    [value]
  );

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (prev === undefined) return;
    redoStack.current.push(value);
    setValueState(prev);
  }, [value]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (next === undefined) return;
    undoStack.current.push(value);
    setValueState(next);
  }, [value]);

  const reset = useCallback((next: string) => {
    setValueState(next);
    undoStack.current = [];
    redoStack.current = [];
  }, []);

  return {
    value,
    setValue,
    undo,
    redo,
    reset,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
}
