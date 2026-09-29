import { useEffect, useState } from "react";
import { staffRequest } from "./service";
import { roleLabel } from "./roles";
import "./presence.css";

const PING_EVERY = 60 * 1000;
const SHOW_AT_MOST = 6;
const initialsOf = (name) => (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "?";

// Header strip: who has the workspace open right now, as initial avatars. The same request is this tab's heartbeat.
export function OnlineNow({ session }) {
  // Start with just you, so the strip is there before (or even without) the first answer.
  const [online, setOnline] = useState([]);
  useEffect(() => {
    let active = true, timer = null;
    const ping = () => {
      clearTimeout(timer);
      // Hidden tabs don't count as working; they ping again as soon as they are shown.
      if (document.visibilityState === "hidden") return;
      staffRequest("presence", { csrf: session.csrf, body: {} })
        .then((result) => { if (active && Array.isArray(result.online)) setOnline(result.online); })
        .catch(() => { /* presence is a nice-to-have; keep the last list */ })
        .finally(() => { if (active) timer = setTimeout(ping, PING_EVERY); });
    };
    ping();
    document.addEventListener("visibilitychange", ping);
    return () => { active = false; clearTimeout(timer); document.removeEventListener("visibilitychange", ping); };
  }, [session.csrf]);
  // Always list yourself first, even before the server has seen your first ping.
  const others = online.filter((person) => person.staffId !== session.staffId);
  const people = [{ key: "you", name: session.name, label: `${session.name} (you)`, role: session.role }, ...others.map((person) => ({ key: person.staffId, name: person.name, label: person.name, role: person.role }))];
  const shown = people.slice(0, SHOW_AT_MOST), hidden = people.slice(SHOW_AT_MOST);
  return (
    <ul className="staff-online-now" aria-label={`Working now: ${people.map((person) => person.label).join(", ")}`}>
      {shown.map((person) => (
        <li key={person.key} className="staff-online-avatar" title={`${person.label} · ${roleLabel(person.role)}`}>
          <span aria-hidden="true">{initialsOf(person.name)}</span>
        </li>
      ))}
      {hidden.length > 0 && <li className="staff-online-avatar is-more" title={hidden.map((person) => `${person.label} · ${roleLabel(person.role)}`).join("\n")}><span aria-hidden="true">+{hidden.length}</span></li>}
    </ul>
  );
}
