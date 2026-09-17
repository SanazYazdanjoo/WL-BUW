import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AppHeader from "./AppHeader";
import { useContent } from "../hooks/useContent";
import { useProgress } from "../hooks/useProgress";
export default function Layout() {
  const content = useContent();

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
      <main
        id="main"
        className={pathname === "/" || pathname === "/journey" ? "main-wide" : undefined}
        tabIndex="-1"
      >
        {content.loading ? (
          <div className="loading-state" role="status">
            <span className="loading-node" aria-hidden="true" />
            <h1>Getting your journey ready</h1>
            <p>Your steps will appear here in a moment.</p>
          </div>
        ) : (
          <ProgressOutlet
            key={content.onboarding.data.progressRevision}
            content={content}
          />
        )}
      </main>
      <footer className="app-footer">
        <div className="footer-inner">
          <span>Welcome Lounge · Bauhaus-Universität Weimar</span>
        </div>
      </footer>
    </div>
  );
}

function ProgressOutlet({ content }) {
  const progress = useProgress(content.onboarding.data.progressRevision);
  return (
    <Outlet
      context={{
        content,
        progress,
        officialSources: content.officialSources || {},
      }}
    />
  );
}
