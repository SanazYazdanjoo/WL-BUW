import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearOfflineData, staffRequest } from "./service";
import { OfflineBanner } from "./OfflineBanner";
import { PasswordInput } from "./PasswordInput";
import { canManage, canManageLogins, roleLabel } from "./roles";
import { OnlineNow } from "./OnlineNow";
import { FeedbackButton } from "./FeedbackButton";

// Line icons for the sidebar (16×16 grid, drawn with the current text colour).
const NAV_ICONS = {
  dashboard: "M8 2.5v1.5M8 12v1.5M2.5 8H4M12 8h1.5M4.1 4.1l1 1M10.9 10.9l1 1M4.1 11.9l1-1M10.9 5.1l1-1M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z",
  students: "M6 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.5 13.5c0-2.2 2-4 4.5-4s4.5 1.8 4.5 4M11 7.5a2 2 0 1 0-.8-3.8M12 9.7c1.5.5 2.5 1.9 2.5 3.8",
  "all-tutors": "M2.5 3.5h11a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 2 12V4a.5.5 0 0 1 .5-.5ZM6 8.2a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8ZM3.8 10.8c.3-1 1.2-1.6 2.2-1.6s1.9.6 2.2 1.6M10 6.5h2M10 9h2",
  shifts: "M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM8 4.5V8l2.5 1.5",
  handover: "M5.5 2.5h5v2h-5zM10.5 3.5H12a1 1 0 0 1 1 1V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1h1.5M5.5 8h5M5.5 10.5h3",
  events: "M3 3.5h10a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5ZM2.5 6.5h11M5.5 2v2.5M10.5 2v2.5",
  "tutor-list": "M8 2.5 1.5 5.5 8 8.5l6.5-3L8 2.5ZM4 6.8v3.4c0 1 1.8 2 4 2s4-1 4-2V6.8M14.5 5.5v4",
  statistics: "M2.5 13.5h11M4.5 11V8M8 11V4.5M11.5 11V6.5",
  activity: "M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.5H5M8 5v3l2 1.5",
  content: "M4 1.5h5.5L12.5 4.5V14a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5ZM9.5 1.5v3h3M5.5 8h5M5.5 10.5h5",
  backup: "M2 3.5h12v3H2zM3 6.5V13a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V6.5M6.5 9h3",
  "sign-ins": "M6.5 4.5V3a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 .5.5v10a.5.5 0 0 1-.5.5H7a.5.5 0 0 1-.5-.5v-1.5M1.5 8H10M7.5 5.5 10 8l-2.5 2.5",
};
const NavIcon = ({ path }) => <svg className="staff-nav-icon" aria-hidden="true" viewBox="0 0 16 16" width="18" height="18"><path d={path} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const SIDEBAR_KEY = "wl-staff-sidebar-collapsed";
export default function StaffLayout() {
  const [session, setSession] = useState(null),
    [loading, setLoading] = useState(true),
    [roster, setRoster] = useState(null),
    [semesterLabel, setSemesterLabel] = useState(""),
    [actorBusy, setActorBusy] = useState(false),
    [loginBusy, setLoginBusy] = useState(false),
    [error, setError] = useState("");
  // Laptop sidebar: full width with labels, or a slim icon rail. Remembered per browser.
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(SIDEBAR_KEY) === "1"; } catch { return false; } });
  const toggleSidebar = () => setCollapsed((current) => { try { localStorage.setItem(SIDEBAR_KEY, current ? "0" : "1"); } catch { /* storage unavailable */ } return !current; });
  const navigate = useNavigate();
  const location = useLocation();
  async function loadRoster() {
    try { setRoster(await staffRequest("roster")); }
    catch { setRoster({ staff: [], etag: null }); }
  }
  useEffect(() => {
    let active = true;
    staffRequest("session")
      .then((s) => {
        if (active) { setSession(s); loadRoster(); }
      })
      .catch((e) => {
        if (active && e.status !== 401) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    let active = true;
    const loadSemester = () => Promise.allSettled([staffRequest("config"), staffRequest("workspace")]).then(([configResult, workspaceResult]) => {
      if (!active) return;
      const published = configResult.status === "fulfilled" ? configResult.value?.config?.semesterLabel || "" : "";
      const operational = workspaceResult.status === "fulfilled" ? workspaceResult.value?.data?.semesterLabel || "" : "";
      setSemesterLabel(published || operational);
    });
    loadSemester();
    window.addEventListener("staff-semester-updated", loadSemester);
    return () => { active = false; window.removeEventListener("staff-semester-updated", loadSemester); };
  }, [session, location.pathname]);
  async function login(event) {
    event.preventDefault();
    setError("");
    setLoginBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await staffRequest("login", {
        body: { username: form.get("username"), password: form.get("password") },
      });
      setSession(await staffRequest("session"));
      await loadRoster();
      navigate("/staff/dashboard");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoginBusy(false);
    }
  }
  async function chooseStaff(event) {
    const staffId = event.target.value;
    if (!staffId) return;
    setActorBusy(true);
    setError("");
    try {
      await staffRequest("actor/select", { csrf: session.csrf, body: { staffId } });
      // Reload the names too: a tutor's first pick creates their staff entry with a new id.
      const [nextSession] = await Promise.all([staffRequest("session"), loadRoster()]);
      setSession(nextSession);
      navigate("/staff/dashboard");
    } catch (e) { setError(e.message); }
    finally { setActorBusy(false); }
  }
  async function logout() {
    // Always remove this tab's offline copy and queued edits, even if the server can't be reached.
    clearOfflineData();
    try {
      await staffRequest("logout", { csrf: session.csrf, body: {} });
    } catch { /* the session cookie still expires; the local copy is already gone */ }
    setSession(null);
    navigate("/staff");
  }
  useEffect(() => {
    const previous = document.title;
    document.title = "Staff workspace · Welcome Lounge";
    return () => { document.title = previous; };
  }, []);
  // In the workspace the account lives at the bottom of the sidebar; on the name/setup screens it stays in the header.
  const pickingName = Boolean(session && roster?.etag && roster.staff.length > 0 && !roster.staff.some((person) => person.id === session.staffId));
  const needsSetup = Boolean(session && roster?.etag && roster.staff.length === 0 && (canManage(session) || !session.staffId));
  const inWorkspace = Boolean(session && !loading && !pickingName && !needsSetup);
  const initials = (session?.name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
  return (
    <div className="app-container staff">
      <a className="skip-link" href="#staff-main">
        Skip to staff content
      </a>
      <header className="staff-header">
        <Link className="staff-brand" to="/staff">
          <span className="staff-badge">Staff workspace</span>
          <span>
            <strong>Welcome Lounge</strong>
            {semesterLabel && <small>{semesterLabel}</small>}
          </span>
        </Link>
        {inWorkspace && <OnlineNow session={session} />}
        <a className="staff-student-site" href="/" target="_blank" rel="noreferrer">Student site ↗</a>
        {session && !inWorkspace && <div className="staff-header-account">
          <Link to="/staff/account" className="staff-identity" aria-label={`Signed in as ${session.name}, ${roleLabel(session.role)}. My account`}>
            <strong>{session.name}</strong>
            <small>{roleLabel(session.role)} · My account</small>
          </Link>
          <button className="staff-signout" onClick={logout}>Sign out</button>
        </div>}
      </header>
      {error && <p className="staff-shell-message" role="alert">{error}</p>}
      {session && <OfflineBanner csrf={session.csrf} />}
      {loading ? (
        <main id="staff-main" className="staff-main"><p role="status">Checking access…</p></main>
      ) : !session ? (
        <main id="staff-main" className="staff-main staff-login-main">
          <section className="staff-login-panel" aria-labelledby="staff-login-title">
            <h1 id="staff-login-title">Staff sign-in</h1>
            <p>
              Use the shared tutor login, or your personal login if you have set one up.
            </p>
          <form onSubmit={login} className="staff-form">
            <label>
              Username
              <input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={100} required />
            </label>
            <label>
              Password
              <PasswordInput name="password" autoComplete="current-password" required />
            </label>
            <button className="primary" disabled={loginBusy}>{loginBusy ? "Signing in…" : "Sign in"}</button>
          </form>
          </section>
        </main>
      ) : (
        <>
          {roster?.etag && roster.staff.length > 0 && !roster.staff.some((person) => person.id === session.staffId) ? (
            <main id="staff-main" className="staff-main staff-login-main">
              <section className="staff-login-panel staff-enter" aria-labelledby="staff-actor-title">
                <h1 id="staff-actor-title">Who is working?</h1>
                <p>Choose your name from the {session.role === "tutor" ? "tutor" : roleLabel(session.role).toLowerCase()} list. It will appear on your updates and handovers.</p>
                <label>Your name<select value="" disabled={actorBusy} onChange={chooseStaff}>
                  <option value="">{session.role === "tutor" ? "Choose your name" : `Choose a ${roleLabel(session.role).toLowerCase()}`}</option>
                  {roster.staff.map((person) => <option value={person.id} key={person.id}>{person.name}{person.program ? ` · ${person.program}` : ""}</option>)}
                </select></label>
              </section>
            </main>
          ) : roster?.etag && roster.staff.length === 0 && (canManage(session) || !session.staffId) ? (
            <main id="staff-main" className={`staff-main${location.pathname === "/staff/content" ? "" : " staff-login-main"}`}>
              {location.pathname === "/staff/content" ? (
                <>
                  <section className="staff-setup-panel" aria-labelledby="staff-setup-title">
                    <h2 id="staff-setup-title">Add the staff list</h2>
                    <p>Add your team below to start recording staff updates.</p>
                  </section>
                  <Outlet context={{ session, refreshRoster: loadRoster }} />
                </>
              ) : (
                <section className="staff-login-panel" aria-labelledby="staff-setup-title">
                  <h1 id="staff-setup-title">{session.role === "tutor" ? "No tutors yet" : "Add the staff list"}</h1>
                  <p>{session.role === "tutor" ? "The tutor list is empty. Ask the Super Admin or a coordinator to add your name on the Tutors page." : `No ${roleLabel(session.role).toLowerCase()} is in the staff list yet. Add them in Content → Staff.`}</p>
                  {canManage(session) ? <Link to="/staff/content">Open Content setup</Link> : <p>Ask a coordinator to add the team.</p>}
                </section>
              )}
            </main>
          ) : (
          <>
          <div className={`staff-dashboard-shell staff-enter${collapsed ? " is-collapsed" : ""}`}>
          <aside className="staff-sidebar-wrap">
          <button type="button" className="staff-sidebar-toggle" aria-expanded={!collapsed} aria-controls="staff-sidebar-nav" title={collapsed ? "Expand menu" : "Collapse menu"} aria-label={collapsed ? "Expand menu" : "Collapse menu"} onClick={toggleSidebar}>
            <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path d={collapsed ? "M4 3.5 8.5 8 4 12.5M8.5 3.5 13 8l-4.5 4.5" : "M12 3.5 7.5 8l4.5 4.5M7.5 3.5 3 8l4.5 4.5"} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>          </button>
          <nav id="staff-sidebar-nav" className="staff-nav staff-sidebar" aria-label="Staff navigation">
            {[
              ["dashboard", "Today"],
              ["students", "Students"],
              ["all-tutors", "All Tutors"],
              ["shifts", "Shifts"],
              ["handover", "Handover"],
              ["events", "Events"],
            ].map(([path, title]) => <NavLink key={path} to={`/staff/${path}`} title={collapsed ? title : undefined}><NavIcon path={NAV_ICONS[path]} /><span className="staff-nav-text">{title}</span></NavLink>)}
            {canManage(session) && <>
              <p className="staff-sidebar-label">Management</p>
              {[
                ["tutor-list", "Tutors"],
                ["statistics", "Statistics"],
                ["activity", "Change log"],
                ["content", "Content"],
                ["backup", "Backup"],
                ...(canManageLogins(session) ? [["sign-ins", "Sign-ins"]] : []),
              ].map(([path, title]) => <NavLink key={path} to={`/staff/${path}`} title={collapsed ? title : undefined}><NavIcon path={NAV_ICONS[path]} /><span className="staff-nav-text">{title}</span></NavLink>)}
            </>}
          </nav>
          <div className="staff-sidebar-footer">
            <NavLink to="/staff/account" className="staff-sidebar-user" title={collapsed ? `${session.name} · My account` : undefined} aria-label={`${session.name}, ${roleLabel(session.role)}. My account`}>
              <span className="staff-avatar" aria-hidden="true">{initials}</span>
              <span className="staff-sidebar-user-text" title={`${session.name} · ${roleLabel(session.role)}`}><strong>{session.name}</strong><small>{roleLabel(session.role)} · My account</small></span>
            </NavLink>
            <button type="button" className="staff-sidebar-signout" title={collapsed ? "Sign out" : undefined} onClick={logout}>
              <svg className="staff-nav-icon" aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path d="M9.5 4.5V3a.5.5 0 0 0-.5-.5H3a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5v-1.5M6 8h8.5M12 5.5 14.5 8 12 10.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="staff-nav-text">Sign out</span>
            </button>
          </div>
          </aside>
          <main id="staff-main" className="staff-main">
            <Outlet context={{ session, refreshRoster: loadRoster }} />
          </main>
          </div>
          <FeedbackButton session={session} />
          </>
          )}
        </>
      )}
    </div>
  );
}
