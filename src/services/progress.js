export const PROGRESS_KEY = "wl-progress";
export const emptyProgress = () => ({ version: 1, completed: [] });
export function parseProgress(raw) {
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !Array.isArray(value.completed))
      return emptyProgress();
    return {
      version: 1,
      completed: [
        ...new Set(
          value.completed.filter(
            (id) => typeof id === "string" && /^[a-z0-9-]{1,80}$/.test(id),
          ),
        ),
      ].slice(0, 200),
    };
  } catch {
    return emptyProgress();
  }
}
export function readProgress(storage) {
  try {
    return {
      value: parseProgress(storage.getItem(PROGRESS_KEY)),
      available: true,
    };
  } catch {
    return { value: emptyProgress(), available: false };
  }
}
export function writeProgress(storage, value) {
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function toggleProgress(value, id) {
  return setCompleted(value, id, !value.completed.includes(id));
}
export function setCompleted(value, id, completed) {
  if (typeof id !== "string" || !/^[a-z0-9-]{1,80}$/.test(id)) return value;
  return {
    version: 1,
    completed: completed
      ? [...new Set([...value.completed, id])]
      : value.completed.filter((x) => x !== id),
  };
}
