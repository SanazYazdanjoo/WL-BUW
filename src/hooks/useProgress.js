import { useEffect, useState } from "react";
import {
  emptyProgress,
  readProgress,
  writeProgress,
  toggleProgress,
  PROGRESS_KEY,
  setCompleted,
} from "../services/progress";
function initial() {
  try {
    return readProgress(window.localStorage);
  } catch {
    return { value: emptyProgress(), available: false };
  }
}
export function useProgress() {
  const [state, setState] = useState(initial);
  useEffect(() => {
    const sync = (event) => {
      if (event.key === PROGRESS_KEY || event.key === null) setState(initial());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const update = (value) => {
    let available = false;
    try {
      available = writeProgress(window.localStorage, value);
    } catch {
      /* private browser mode */
    }
    setState({ value, available });
  };
  return {
    completed: state.value.completed,
    available: state.available,
    isComplete: (id) => state.value.completed.includes(id),
    markComplete: (id) => update(setCompleted(state.value, id, true)),
    markIncomplete: (id) => update(setCompleted(state.value, id, false)),
    totalCompleted: state.value.completed.length,
    toggle: (id) => update(toggleProgress(state.value, id)),
    reset: () => update(emptyProgress()),
  };
}
