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
        <Link to="/">Welcome Lounge</Link>
        <span>Private staff workspace</span>
        {session && <button onClick={logout}>Sign out</button>}
      </header>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Checking staff access…</p>
      ) : !session ? (
        <main id="staff-main">
          <h1>Staff sign-in</h1>
          <p>
            Use your name and the pilot access code provided by the coordinator.
            Students do not need an account.
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
        </main>
      ) : (
        <>
          <p className="staff-identity">
            Signed in as {session.name} · {session.role}. Pilot attribution uses
            the name you entered.
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
                    ["content", "Content & semester"],
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
          <main id="staff-main">
            <Outlet context={{ session }} />
          </main>
        </>
      )}
    </div>
  );
}
