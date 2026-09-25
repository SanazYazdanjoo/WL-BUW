import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { staffRequest } from "./service";
export default function StaffLayout() {
  const [session, setSession] = useState(null),
    [loading, setLoading] = useState(true),
    [roster, setRoster] = useState(null),
    [semesterLabel, setSemesterLabel] = useState(""),
    [actorBusy, setActorBusy] = useState(false),
    [loginBusy, setLoginBusy] = useState(false),
    [error, setError] = useState("");
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
      setSession(await staffRequest("session"));
    } catch (e) { setError(e.message); }
    finally { setActorBusy(false); }
  }
  async function logout() {
    try {
      await staffRequest("logout", { csrf: session.csrf, body: {} });
      setSession(null);
      navigate("/staff");
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    const previous = document.title;
    document.title = "Staff workspace · Welcome Lounge";
    return () => { document.title = previous; };
  }, []);
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
        <a className="staff-student-site" href="/" target="_blank" rel="noreferrer">Student site ↗</a>
        {session && <div className="staff-header-account">
          <Link to="/staff/account" className="staff-identity" aria-label={`Signed in as ${session.name}, ${session.role === "admin" ? "Super Admin" : "Tutor"}. My account`}>
            <strong>{session.name}</strong>
            <small>{session.role === "admin" ? "Super Admin" : "Tutor"} · My account</small>
          </Link>
          <button className="staff-signout" onClick={logout}>Sign out</button>
        </div>}
      </header>
      {error && <p className="staff-shell-message" role="alert">{error}</p>}
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
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="primary" disabled={loginBusy}>{loginBusy ? "Signing in…" : "Sign in"}</button>
          </form>
          </section>
        </main>
      ) : (
        <>
          {roster?.etag && roster.staff.length > 0 && !roster.staff.some((person) => person.id === session.staffId) ? (
            <main id="staff-main" className="staff-main staff-login-main">
              <section className="staff-login-panel" aria-labelledby="staff-actor-title">
                <h1 id="staff-actor-title">Who is working?</h1>
                <p>Your name will appear on updates and handovers.</p>
                <label>Your name<select value="" disabled={actorBusy} onChange={chooseStaff}>
                  <option value="">Choose a staff member</option>
                  {roster.staff.map((person) => <option value={person.id} key={person.id}>{person.name}{person.program ? ` · ${person.program}` : ""}</option>)}
                </select></label>
              </section>
            </main>
          ) : roster?.etag && roster.staff.length === 0 && (session.role === "admin" || !session.staffId) ? (
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
                  <h1 id="staff-setup-title">Add the staff list</h1>
                  <p>Add your team in Content to start recording staff updates.</p>
                  {session.role === "admin" ? <Link to="/staff/content">Open Content setup</Link> : <p>Ask a coordinator to add the team.</p>}
                </section>
              )}
            </main>
          ) : (
          <>
          <div className="staff-dashboard-shell">
          <nav className="staff-nav staff-sidebar" aria-label="Staff navigation">
            {[
              ["dashboard", "Today"],
              ["students", "Students"],
              ["shifts", "Schedule"],
              ["handover", "Handover"],
              ["events", "Events"],
            ].map(([path, title]) => <NavLink key={path} to={`/staff/${path}`}>{title}</NavLink>)}
            {session.role === "admin" && <>
              <p className="staff-sidebar-label">Super Admin</p>
              {[
                ["tutor-list", "Tutors"],
                ["statistics", "Statistics"],
                ["activity", "Change log"],
                ["content", "Content"],
                ["backup", "Backup"],
              ].map(([path, title]) => <NavLink key={path} to={`/staff/${path}`}>{title}</NavLink>)}
            </>}
          </nav>
          <main id="staff-main" className="staff-main">
            <Outlet context={{ session, refreshRoster: loadRoster }} />
          </main>
          </div>
          </>
          )}
        </>
      )}
    </div>
  );
}
