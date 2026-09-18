import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { staffRequest } from "./service";
export default function StaffLayout() {
  const [session, setSession] = useState(null),
    [loading, setLoading] = useState(true),
    [roster, setRoster] = useState(null),
    [semesterLabel, setSemesterLabel] = useState(""),
    [actorBusy, setActorBusy] = useState(false),
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
    const form = new FormData(event.currentTarget);
    try {
      await staffRequest("login", {
        body: { name: form.get("name") || "Staff member", code: form.get("code") },
      });
      setSession(await staffRequest("session"));
      await loadRoster();
      navigate("/staff/dashboard");
    } catch (e) {
      setError(e.message);
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
  function goBack() {
    const path = location.pathname;
    if (/^\/staff\/students\/[^/]+$/.test(path)) return navigate("/staff/students");
    if (path !== "/staff/dashboard") return navigate("/staff/dashboard");
    navigate("/");
  }
  return (
    <div className="app-container staff">
      <a className="skip-link" href="#staff-main">
        Skip to staff content
      </a>
      <header className="staff-header">
        <Link className="staff-brand" to="/">
          <span className="staff-brand-mark" aria-hidden="true" />
          <span>
            <strong>Welcome Lounge</strong>
            {semesterLabel && <small>{semesterLabel}</small>}
          </span>
        </Link>
        <span className="staff-header-title">Private staff workspace</span>
        {session && <div className="staff-header-account">
          <span className="staff-identity" aria-label={`Signed in as ${session.name}, ${session.role}`}>
            Signed in as {session.name} · {session.role === "admin" ? "Coordinator" : "Tutor"}
          </span>
          <button className="staff-signout" onClick={logout}>Sign out</button>
        </div>}
      </header>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Checking staff access…</p>
      ) : !session ? (
        <main id="staff-main" className="staff-main staff-login-main">
          <section className="staff-login-panel" aria-labelledby="staff-login-title">
            <p className="staff-eyebrow">WELCOME LOUNGE · STAFF</p>
            <h1 id="staff-login-title">Staff sign-in</h1>
            <p>
              Use your name and the pilot access code provided by the coordinator.
            </p>
          <form onSubmit={login} className="staff-form">
            <label>
              Your name
              <input name="name" autoComplete="name" maxLength={100} />
            </label>
            <label>
              Access code
              <input
                name="code"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="primary">Sign in</button>
          </form>
          </section>
        </main>
      ) : (
        <>
          {roster?.etag && roster.staff.length > 0 && !roster.staff.some((person) => person.id === session.staffId) ? (
            <main id="staff-main" className="staff-main staff-login-main">
              <section className="staff-login-panel" aria-labelledby="staff-actor-title">
                <p className="staff-eyebrow">STAFF IDENTITY</p>
                <h1 id="staff-actor-title">Who is working?</h1>
                <p>Choose your name so updates and handovers are attributed to the right person.</p>
                <label>Your name<select value="" disabled={actorBusy} onChange={chooseStaff}>
                  <option value="">Choose a staff member</option>
                  {roster.staff.map((person) => <option value={person.id} key={person.id}>{person.name}{person.program ? ` · ${person.program}` : ""}</option>)}
                </select></label>
              </section>
            </main>
          ) : roster?.etag && roster.staff.length === 0 && (session.role === "admin" || !session.staffId) ? (
            <main id="staff-main" className="staff-main staff-login-main">
              <section className="staff-login-panel" aria-labelledby="staff-setup-title">
                <p className="staff-eyebrow">STAFF SETUP</p>
                <h1 id="staff-setup-title">Add the staff list</h1>
                <p>A coordinator needs to add active staff names in Content before staff updates can be attributed.</p>
                {session.role === "admin" ? <><Link to="/staff/content">Open Content setup</Link><Outlet context={{ session, refreshRoster: loadRoster }} /></> : <p>Ask a coordinator to add the team.</p>}
              </section>
            </main>
          ) : (
          <>
          <nav className="staff-nav" aria-label="Staff navigation">
            {[
              ["dashboard", "Today"],
              ["students", "Students"],
              ["shifts", "Schedule"],
              ["handover", "Handover"],
              ...(session.role === "admin"
                ? [
                    ["content", "Content"],
                    ["backup", "Backup"],
                  ]
                : []),
            ].map(([path, title]) => (
              <NavLink key={path} to={`/staff/${path}`}>
                {title}
              </NavLink>
            ))}
          </nav>
          <div className="staff-page-actions">
            <button type="button" className="staff-back-button" onClick={goBack} aria-label="Go back">← Back</button>
            <button type="button" className="staff-cancel-button" onClick={() => navigate("/staff/dashboard")}>Cancel</button>
          </div>
          <main id="staff-main" className="staff-main">
            <Outlet context={{ session, refreshRoster: loadRoster }} />
          </main>
          </>
          )}
        </>
      )}
    </div>
  );
}
