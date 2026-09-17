import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { staffRequest } from "./service";

const labels = {
  current: "Current",
  stale: "Could not confirm recently",
  "needs-review": "Review update",
  unavailable: "No stored update",
};
const resultLabels = {
  updated: "updated",
  "no-change": "no changes",
  "needs-review": "needs review",
  "fetch-failed": "could not verify; previous information was kept",
  "parse-failed": "could not verify; previous information was kept",
  unavailable: "cache is unavailable; check server configuration",
  "cache-unavailable": "cache is unavailable; previous information was kept",
  disabled: "source synchronization is disabled",
};
const routeIds = { preparingStudies: "preparing-studies", welcomeEvents: "welcome-events" };
const dateText = (value) => value
  ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(value))
  : "Not checked yet";

export default function OfficialSourcesPage() {
  const { session } = useOutletContext();
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await staffRequest("sources");
      setSources(result.sources);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    staffRequest("sources")
      .then((result) => { if (active) setSources(result.sources); })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function synchronize() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await staffRequest("sources/sync", { csrf: session?.csrf, body: {} });
      setMessage(result.results.map((item) => `${item.sourceId}: ${resultLabels[item.result] || "could not be updated"}`).join(" · "));
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function accept(source) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await staffRequest(`sources/${routeIds[source.sourceId]}/accept`, {
        csrf: session?.csrf,
        body: {},
      });
      setMessage(`${source.label}: ${resultLabels[result.result] || "could not be updated"}`);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="staff-sources">
      <h1>Official information</h1>
      <p>University pages are checked automatically. Local Welcome Lounge content stays separate.</p>
      <button className="primary" disabled={busy || loading} onClick={synchronize}>
        {busy ? "Refreshing…" : "Refresh official information"}
      </button>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {loading ? <p role="status">Loading source status…</p> : sources.map((source) => (
        <article className="staff-source" key={source.sourceId}>
          <header>
            <h2>{source.label}</h2>
            <strong>{labels[source.status] || "Status unavailable"}</strong>
          </header>
          <p>Last successful check: {dateText(source.lastSuccessfulCheck)}</p>
          <p>Last content change: {dateText(source.lastChangedAt)}</p>
          <p>{source.itemCount} published {source.sourceId === "welcomeEvents" ? "events" : "sections"}</p>
          <a href={source.url} target="_blank" rel="noopener noreferrer">View official page ↗</a>
          {source.lastFailure && <p className="source-admin-warning">{source.lastFailure}</p>}
          {source.warnings?.map((warning) => <p className="source-admin-warning" key={warning}>{warning}</p>)}
          {source.pendingReview && (
            <div className="source-review">
              <p>{source.pendingReview.reason} A new update is held until a coordinator reviews the official page.</p>
              <p>Held update contains {source.pendingReview.count} {source.sourceId === "welcomeEvents" ? "events" : "sections"}.</p>
              <button disabled={busy} onClick={() => accept(source)}>Use reviewed update</button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
