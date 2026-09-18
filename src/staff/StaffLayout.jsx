import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { staffRequest } from "./service";
export default function StaffLayout() {
  const [session, setSession] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    staffRequest("session")
      .then((s) => {
        if (active) setSession(s);
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
  async function login(event) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await staffRequest("login", {
        body: { name: form.get("name"), code: form.get("code") },
      });
      setSession(await staffRequest("session"));
      navigate("/staff/dashboard");
    } catch (e) {
      setError(e.message);
    }
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
            <small>Private staff workspace</small>
          </span>
        </Link>
        {session && <button className="staff-signout" onClick={logout}>Sign out</button>}
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
              <input name="name" autoComplete="name" required maxLength={100} />
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
          <p className="staff-identity" aria-label={`Signed in as ${session.name}, ${session.role}`}>
            Signed in as {session.name} · {session.role === "admin" ? "coordinator" : "tutor"}. Your name is used for pilot activity notes.
          </p>
          <nav className="staff-nav" aria-label="Staff navigation">
            {[
              ["dashboard", "Today"],
              ["students", "Students"],
              ["shifts", "Shifts"],
              ["program-tutors", "Program tutors"],
              ["handover", "Handover"],
              ["reports", "Reports"],
              ...(session.role === "admin"
                ? [
                    ["data", "Import & export"],
                    ["content", "Content"],
                    ["sources", "Official information"],
                    ["print", "Print center"],
                  ]
                : []),
            ].map(([path, title]) => (
              <NavLink key={path} to={`/staff/${path}`}>
                {title}
              </NavLink>
            ))}
          </nav>
          <main id="staff-main" className="staff-main">
            <Outlet context={{ session }} />
          </main>
        </>
      )}
    </div>
  );
}
