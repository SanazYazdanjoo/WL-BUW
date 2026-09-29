import { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { staffRequest } from "./service";

// How often an open page picks up changes other staff have saved.
export const WORKSPACE_REFRESH_INTERVAL = 15000;

export function useWorkspace() {
  const { session } = useOutletContext();
  const [workspace, setWorkspace] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  // Each read is numbered; an answer that arrives after a newer one was shown is dropped,
  // so a slow refresh can never put older data back on screen.
  const requested = useRef(0), shown = useRef(0);
  const fetchWorkspace = useCallback(async () => {
    const number = ++requested.current;
    const result = await staffRequest("workspace");
    if (number > shown.current) {
      shown.current = number;
      setWorkspace(result);
    }
    return result;
  }, []);
  useEffect(() => {
    let active = true;
    // Nextcloud sometimes fails for a moment: retry server-side failures twice before showing an error.
    const load = async (attempt) => {
      try {
        await fetchWorkspace();
      } catch (e) {
        const temporary = !e.status || e.status >= 500;
        if (active && temporary && attempt < 2) setTimeout(() => { if (active) load(attempt + 1); }, attempt === 0 ? 1000 : 3000);
        else if (active) setError(e.message);
      }
    };
    load(0);
    // Once queued offline edits are saved, and regularly while the page is open, show what others saved.
    const refresh = () => { if (active && document.visibilityState === "visible") fetchWorkspace().catch(() => {}); };
    const timer = setInterval(refresh, WORKSPACE_REFRESH_INTERVAL);
    window.addEventListener("staff-queue-flushed", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("staff-queue-flushed", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [fetchWorkspace]);
  async function act(action, body) {
    setBusy(true);
    setError("");
    try {
      await staffRequest(action, {
        csrf: session.csrf,
        // Forms pass the etag from when editing began, so a background refresh can't hide others' changes.
        body: { etag: workspace.etag, ...body },
      });
      await fetchWorkspace();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function autosave(action, id, patch, base) {
    await staffRequest(action, {
      csrf: session.csrf,
      body: { id, patch, base, etag: workspace?.etag },
    });
    return fetchWorkspace();
  }
  const reload = useCallback(async () => {
    await fetchWorkspace();
  }, [fetchWorkspace]);
  return { workspace, error, busy, act, autosave, reload };
}
