import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { staffRequest } from "./service";
export function useWorkspace() {
  const { session } = useOutletContext();
  const [workspace, setWorkspace] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    staffRequest("workspace")
      .then((r) => {
        if (active) setWorkspace(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
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
  return { workspace, error, busy, act };
}
