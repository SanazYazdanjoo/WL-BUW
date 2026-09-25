import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { staffRequest } from "./service";
export function useWorkspace() {
  const { session } = useOutletContext();
  const [workspace, setWorkspace] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    // Nextcloud sometimes fails for a moment: retry server-side failures twice before showing an error.
    const load = async (attempt) => {
      try {
        const result = await staffRequest("workspace");
        if (active) setWorkspace(result);
      } catch (e) {
        const temporary = !e.status || e.status >= 500;
        if (active && temporary && attempt < 2) setTimeout(() => { if (active) load(attempt + 1); }, attempt === 0 ? 1000 : 3000);
        else if (active) setError(e.message);
      }
    };
    load(0);
    return () => {
      active = false;
    };
  }, []);
  async function act(action, body) {
    setBusy(true);
    setError("");
    try {
      await staffRequest(action, {
        csrf: session.csrf,
        body: { ...body, etag: workspace.etag },
      });
      setWorkspace(await staffRequest("workspace"));
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
    const latest = await staffRequest("workspace");
    setWorkspace(latest);
    return latest;
  }
  const reload = useCallback(async () => {
    setWorkspace(await staffRequest("workspace"));
  }, []);
  return { workspace, error, busy, act, autosave, reload };
}
