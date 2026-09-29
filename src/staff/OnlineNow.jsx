import { useEffect, useState } from "react";
import { staffRequest } from "./service";
import { roleLabel } from "./roles";
import "./presence.css";

const PING_EVERY = 60 * 1000;

// Header strip: who has the workspace open right now. The same request is this tab's heartbeat.
export function OnlineNow({ session }) {
  const [online, setOnline] = useState(null);
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
  if (!online) return null;
  // Always list yourself first, even before the server has seen your first ping.
  const others = online.filter((person) => person.staffId !== session.staffId);
  const names = [`${session.name} (you)`, ...others.map((person) => person.name)];
  const detail = [`${session.name} (you) · ${roleLabel(session.role)}`, ...others.map((person) => `${person.name} · ${roleLabel(person.role)}`)].join("\n");
  return (
    <p className="staff-online-now" title={detail} aria-label={`Working now: ${names.join(", ")}`}>
      <span className="staff-online-dot" aria-hidden="true" />
      <span className="staff-online-count" aria-hidden="true">{names.length} online</span>
      <span className="staff-online-names" aria-hidden="true">{names.join(", ")}</span>
    </p>
  );
}
