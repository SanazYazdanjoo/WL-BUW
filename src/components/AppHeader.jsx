import { useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

export default function AppHeader() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef(null);
  const { pathname } = useLocation();
  return (
    <header
      className="app-header"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <Link className="brand" to="/" aria-label="Welcome Lounge home">
        <span className="brand-mark" aria-hidden="true" />
        <span>
          Welcome Lounge
          <span className="university">Bauhaus-Universität Weimar</span>
        </span>
      </Link>
      <button
        ref={menuButton}
        className="menu-toggle"
        aria-expanded={open}
        aria-controls="public-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? "Close menu" : "Menu"}{" "}
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <nav
        id="public-navigation"
        className={open ? "public-nav is-open" : "public-nav"}
        aria-label="Main navigation"
      >
        <NavLink
          to="/journey"
          className={pathname === "/" ? "active" : undefined}
          aria-current={pathname === "/" ? "page" : undefined}
        >
          Journey
        </NavLink>
        <NavLink to="/events">Events</NavLink>
        <NavLink to="/after-arrival">Explore</NavLink>
        <NavLink to="/help">Help</NavLink>
      </nav>
    </header>
  );
}
