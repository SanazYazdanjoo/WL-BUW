import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { staffRequest } from "./service";
import { canManageLogins, roleLabel } from "./roles";
import "./presence.css";

const EVENTS = { "sign-in": "Signed in", name: "Chose name", "sign-out": "Signed out", failed: "Failed sign-in" };
const when = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(date);
};
const methodLabel = (method) => (method === "personal" ? "Personal login" : method === "shared" ? "Shared login" : "");

// Admin and Super Admin: who signed in, chose a name, signed out, or failed to sign in — newest first.
export default function LoginHistoryPage() {
  const { session } = useOutletContext();
  const [data, setData] = useState(null), [error, setError] = useState(""), [event, setEvent] = useState(""), [query, setQuery] = useState("");
  useEffect(() => {
    if (!canManageLogins(session)) return undefined;
    let active = true;
    staffRequest("logins").then((result) => { if (active) setData(result); }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [session]);
  if (!canManageLogins(session)) return <div className="staff-page"><h1>Sign-ins</h1><p>Only the Super Admin or an Admin can see the sign-in history.</p></div>;
  if (!data) return <p role={error ? "alert" : "status"}>{error || "Loading sign-ins…"}</p>;
  const needle = query.trim().toLowerCase();
  const entries = data.entries.filter((entry) => (!event || entry.event === event) && (!needle || `${entry.name} ${entry.login}`.toLowerCase().includes(needle)));
  return (
    <div className="staff-page staff-login-history-page">
      <header className="staff-page-heading"><h1>Sign-ins <span className="staff-count">{entries.length}</span></h1></header>
      <section className="staff-panel">
        <h2>Online now</h2>
        {data.online.length ? <ul className="staff-online-list">{data.online.map((person) => <li key={person.staffId}><span className="staff-online-dot" aria-hidden="true" />{person.name} <span className="staff-muted">· {roleLabel(person.role)} · since {when(person.since)}</span></li>)}</ul> : <p className="staff-muted">Nobody else has the workspace open.</p>}
      </section>
      <div className="staff-student-toolbar">
        <label className="staff-search">Search<input type="search" placeholder="Name or username" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <label>Event<select value={event} onChange={(e) => setEvent(e.target.value)}><option value="">All events</option>{Object.entries(EVENTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      {entries.length === 0 ? <p className="staff-empty-state">No sign-ins found.</p> : <div className="table-scroll">
        <table aria-label="Sign-in history" className="staff-mobile-cards">
          <thead><tr><th>When</th><th>Who</th><th>Username</th><th>Event</th></tr></thead>
          <tbody>{entries.map((entry) => <tr key={entry.id} className={entry.event === "failed" ? "is-failed" : undefined}>
            <td data-label="When">{when(entry.at)}</td>
            <td data-label="Who">{entry.name || (entry.event === "failed" ? "—" : "Name not chosen yet")}{entry.role && <span className="staff-muted"> · {roleLabel(entry.role)}</span>}</td>
            <td data-label="Username">{entry.login || "—"}</td>
            <td data-label="Event">{EVENTS[entry.event] || entry.event}{methodLabel(entry.method) && <span className="staff-muted"> · {methodLabel(entry.method)}</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <p className="staff-muted">The latest 1,000 events. Passwords are never recorded. After the shared login, a second row shows the name the person chose.</p>
    </div>
  );
}
