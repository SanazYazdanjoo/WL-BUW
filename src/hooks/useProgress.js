import { useEffect, useState } from "react";
import {
  emptyProgress,
  readProgress,
  writeProgress,
  toggleProgress,
  PROGRESS_KEY,
  setCompleted,
} from "../services/progress";
function initial(key) {
  try {
    return readProgress(window.localStorage, key);
  } catch {
    return { value: emptyProgress(), available: false };
  }
}
export function useProgress(revision = "legacy") {
  const key =
    revision === "legacy" ? PROGRESS_KEY : `${PROGRESS_KEY}:${revision}`;
  const [state, setState] = useState(() => initial(key));
  useEffect(() => {
    const sync = (event) => {
      if (event.key === key || event.key === null) setState(initial(key));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key]);
  const update = (value) => {
    let available = false;
    try {
      available = writeProgress(window.localStorage, value, key);
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
