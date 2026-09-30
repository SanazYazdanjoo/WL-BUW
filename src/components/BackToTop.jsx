import { useEffect, useState } from "react";

// A full-width "Back to top" button at the end of long pages. CSS shows it on phones only;
// it appears once the page is more than two screens tall.
export default function BackToTop({ targetId }) {
  const [long, setLong] = useState(false);
  useEffect(() => {
    const check = () => setLong(document.documentElement.scrollHeight > window.innerHeight * 2);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(document.body);
    window.addEventListener("resize", check);
    return () => { observer.disconnect(); window.removeEventListener("resize", check); };
  }, []);
  if (!long) return null;
  function toTop() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    document.getElementById(targetId)?.focus({ preventScroll: true });
  }
  return (
    <button type="button" className="primary back-to-top" onClick={toTop}>
      <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      Back to top
    </button>
  );
}
