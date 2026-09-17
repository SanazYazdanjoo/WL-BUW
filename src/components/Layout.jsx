import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import AppHeader from "./AppHeader";
import { useContent } from "../hooks/useContent";
import { useProgress } from "../hooks/useProgress";
export default function Layout() {
  const content = useContent();
  const progress = useProgress();
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = "Welcome Lounge · Bauhaus-Universität Weimar";
    window.scrollTo(0, 0);
    document.getElementById("main")?.focus();
  }, [pathname]);
  return (
    <div className="app-container">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <AppHeader key={pathname} />
      <main id="main" tabIndex="-1">
        {content.loading ? (
          <div className="loading-state" role="status">
            <span className="loading-node" aria-hidden="true" />
            <h1>Getting your journey ready</h1>
            <p>Your steps will appear here in a moment.</p>
          </div>
        ) : (
          <>
            {Object.values(content).some((v) => v?.source === "demo") && (
              <aside className="service-notice">
                Preview content · Some guidance is not available yet. Samples
                are labelled below.{" "}
                <button className="text-button" onClick={content.retry}>
                  Try again
                </button>
              </aside>
            )}
            <Outlet context={{ content, progress }} />
          </>
        )}
      </main>
      <footer>
        <p>Welcome Lounge · Built for your arrival in Weimar.</p>
        <Link to="/help">Help & privacy</Link>
        <Link to="/feedback">Feedback</Link>
        <Link to="/staff">Staff area</Link>
      </footer>
    </div>
  );
}
