import { useEffect, useState } from "react";
import { dismissConflicts, flushQueue, subscribeOffline } from "./service";

const time = (iso) => (iso ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso)) : "");

// Shown while Nextcloud can't be reached, while edits wait to be saved, or when a queued edit clashed.
export function OfflineBanner({ csrf }) {
  const [state, setState] = useState({ offline: false, since: "", queued: 0, conflicts: [] });
  useEffect(() => subscribeOffline(setState), []);
  if (!state.offline && !state.queued && !state.conflicts.length) return null;
  const changes = `${state.queued} ${state.queued === 1 ? "change" : "changes"}`;
  return (
    <div className="staff-offline" role="status" aria-live="polite">
      {(state.offline || state.queued > 0) && (
        <p>
          <strong>{state.offline ? "Offline:" : "Saving…"}</strong>{" "}
          {state.offline ? `The university's Nextcloud can't be reached. You're seeing the data from ${time(state.since) || "earlier"}.` : ""}
          {state.queued > 0 ? ` ${changes} will be saved automatically when the connection is back.` : " You can keep working; new changes will be saved later."}
          {" "}<button type="button" onClick={() => flushQueue(csrf)}>Try now</button>
        </p>
      )}
      {state.conflicts.length > 0 && (
        <p className="staff-offline-conflict">
          <strong>Not saved:</strong> {state.conflicts.length === 1 ? "one change was" : `${state.conflicts.length} changes were`} not applied because the data changed in the meantime ({state.conflicts.join(" · ")}). Please check and enter it again.{" "}
          <button type="button" onClick={dismissConflicts}>OK</button>
        </p>
      )}
    </div>
  );
}
