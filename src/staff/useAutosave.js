import { useCallback, useEffect, useRef, useState } from "react";

export const AUTOSAVE_DELAY = 2000;
export const AUTOSAVE_TOGGLE_DELAY = 300;
const changedFields = (next, base) => Object.keys(next).filter((field) => !Object.is(next[field], base[field]));

export function useAutosave(initialValue, save, { delay = AUTOSAVE_DELAY, validate } = {}) {
  const [draft, setDraft] = useState(initialValue);
  const [status, setStatus] = useState("idle");
  const [errorText, setErrorText] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [conflict, setConflict] = useState(null);
  const conflictRef = useRef(null);
  const draftRef = useRef(initialValue);
  const savedRef = useRef(initialValue);
  const saveRef = useRef(save);
  const validateRef = useRef(validate);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);
  const savingRef = useRef(false);
  const inFlightRef = useRef(null);
  const revisionRef = useRef(0);
  const retryTimerRef = useRef(null);
  const flushRef = useRef(() => {});

  useEffect(() => { saveRef.current = save; validateRef.current = validate; });

  const flush = useCallback(async () => {
    clearTimeout(timerRef.current);
    clearTimeout(retryTimerRef.current);
    if (savingRef.current || conflictRef.current) return;
    const fields = changedFields(draftRef.current, savedRef.current);
    if (!fields.length) {
      if (mountedRef.current) { setStatus("idle"); setHasUnsavedChanges(false); }
      return;
    }
    const revision = revisionRef.current;
    const snapshot = Object.fromEntries(fields.map((field) => [field, draftRef.current[field]]));
    const base = Object.fromEntries(fields.map((field) => [field, savedRef.current[field]]));
    const validationError = validateRef.current?.(draftRef.current);
    if (validationError) {
      if (mountedRef.current) { setErrorText(validationError); setStatus("error"); }
      return;
    }
    savingRef.current = true;
    if (mountedRef.current) setStatus("saving");
    try {
      const operation = saveRef.current(snapshot, base).then((result) => {
        for (const field of fields) savedRef.current = { ...savedRef.current, [field]: snapshot[field] };
        if (mountedRef.current) setHasUnsavedChanges(changedFields(draftRef.current, savedRef.current).length > 0);
        return result;
      });
      inFlightRef.current = operation;
      const result = await operation;
      if (mountedRef.current) {
        if (result?.conflict) { conflictRef.current = result.conflict; setConflict(result.conflict); }
        else { setErrorText(""); setStatus("saved"); }
      }
      if (revisionRef.current !== revision && !result?.conflict) {
        if (mountedRef.current) setStatus("dirty");
        timerRef.current = setTimeout(() => { void flushRef.current(); }, delay);
      }
    } catch (error) {
      if (mountedRef.current) {
        if (error.status === 409 && error.latest) {
          const conflictFields = error.fields || [];
          const details = { fields: conflictFields, latest: error.latest, mine: Object.fromEntries(conflictFields.map((field) => [field, draftRef.current[field]])) };
          conflictRef.current = details;
          setConflict(details);
          setStatus("conflict");
        } else { setErrorText(navigator.onLine === false ? "Offline — changes are not saved yet." : error.message || "The change could not be saved."); setStatus("error"); }
      }
    } finally {
      savingRef.current = false;
      inFlightRef.current = null;
    }
  }, [delay]);
  useEffect(() => { flushRef.current = flush; }, [flush]);

  const setField = useCallback((field, value, fieldDelay = delay) => {
    const next = { ...draftRef.current, [field]: value };
    draftRef.current = next;
    revisionRef.current += 1;
    setDraft(next);
    setHasUnsavedChanges(true);
    if (conflictRef.current) {
      const updatedConflict = { ...conflictRef.current, mine: { ...conflictRef.current.mine, [field]: value } };
      conflictRef.current = updatedConflict;
      setConflict(updatedConflict);
      setStatus("conflict");
      return;
    }
    setConflict(null);
    setErrorText("");
    setStatus("dirty");
    clearTimeout(timerRef.current);
    clearTimeout(retryTimerRef.current);
    timerRef.current = setTimeout(() => { void flush(); }, fieldDelay);
  }, [delay, flush]);

  const retry = useCallback(() => {
    setErrorText("");
    setStatus("dirty");
    clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => { void flush(); }, 0);
  }, [flush]);

  const resolveConflict = useCallback((useMine) => {
    const currentConflict = conflictRef.current;
    if (!currentConflict) return;
    const next = { ...draftRef.current };
    if (!useMine) for (const field of currentConflict.fields) next[field] = currentConflict.latest[field];
    draftRef.current = next;
    savedRef.current = { ...savedRef.current, ...currentConflict.latest };
    setDraft(next);
    setHasUnsavedChanges(changedFields(next, savedRef.current).length > 0);
    conflictRef.current = null;
    setConflict(null);
    setStatus("dirty");
    timerRef.current = setTimeout(() => { void flush(); }, useMine ? 0 : delay);
  }, [delay, flush]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
      clearTimeout(retryTimerRef.current);
      void (async () => {
        await inFlightRef.current?.catch(() => {});
        const fields = changedFields(draftRef.current, savedRef.current);
        if (!fields.length || conflictRef.current) return;
        if (validateRef.current?.(draftRef.current)) return;
        const patch = Object.fromEntries(fields.map((field) => [field, draftRef.current[field]]));
        const base = Object.fromEntries(fields.map((field) => [field, savedRef.current[field]]));
        await saveRef.current(patch, base).catch(() => {});
      })();
    };
  }, []);

  useEffect(() => {
    const warn = (event) => {
      if (hasUnsavedChanges || savingRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);

  return { draft, setField, status, error: errorText, conflict, retry, flush, resolveConflict, hasUnsavedChanges };
}
