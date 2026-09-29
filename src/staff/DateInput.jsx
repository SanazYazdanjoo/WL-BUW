import { useRef, useState } from "react";
import { formatDate, parseDate } from "../../shared/dates";

// Date field typed as DD.MM.YYYY (browsers' own date inputs follow the device locale).
// value and onChange use ISO YYYY-MM-DD; the calendar button opens the browser's picker.
export function DateInput({ value = "", onChange, min, required, ...props }) {
  const [text, setText] = useState(formatDate(value));
  const [shown, setShown] = useState(value);
  const input = useRef(null);
  const picker = useRef(null);
  // Follow value changes from outside (reset, reload) without overwriting what is being typed.
  if (value !== shown) {
    setShown(value);
    if (parseDate(text) !== value) setText(formatDate(value));
  }
  const change = (next) => {
    setText(next);
    const iso = parseDate(next);
    const problem = next.trim() && !iso ? "Enter the date as DD.MM.YYYY." : iso && min && iso < min ? `Choose ${formatDate(min)} or later.` : "";
    input.current?.setCustomValidity(problem);
    if (!next.trim()) onChange("");
    else if (iso) onChange(iso);
  };
  const openPicker = () => {
    try { picker.current?.showPicker(); } catch { input.current?.focus(); }
  };
  return (
    <span className="staff-date">
      <input {...props} ref={input} type="text" inputMode="numeric" placeholder="DD.MM.YYYY" maxLength={10} autoComplete="off" required={required} value={text} onChange={(e) => change(e.target.value)} onBlur={() => { const iso = parseDate(text); if (iso) setText(formatDate(iso)); }} />
      <button type="button" className="staff-date-button" aria-label="Choose from calendar" onClick={openPicker}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
      </button>
      <input ref={picker} type="date" className="staff-date-picker" tabIndex={-1} aria-hidden="true" min={min} value={parseDate(text) || ""} onChange={(e) => change(formatDate(e.target.value))} />
    </span>
  );
}
