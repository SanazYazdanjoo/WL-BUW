import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { canonicalCountry, searchCountries } from "./studentOptions";
import { ComboInput } from "./ComboInput";

// Country field: finds everyday names, official names and aliases ("USA",
// "South Korea", "Persia") and saves the standard spelling.
const countryNoMatch = (text) => `No country matches “${text}”. It will be saved as typed.`;

export function CountryInput(props) {
  return <ComboInput {...props} title="Countries" search={searchCountries} canonical={canonicalCountry} noMatch={countryNoMatch} />;
}

// Study programme field: a plain dropdown on every device. A programme that is
// not in the list (older records) is kept as an extra option so it still shows.
// The last option swaps the dropdown for a text field to type a new programme;
// Enter or leaving the field keeps it, Esc goes back to the previous choice.
const NEW_PROGRAM = "\u0000new";

export function ProgramInput({ options, value, onChange, className, ...props }) {
  const current = value || "";
  const list = current && !options.includes(current) ? [current, ...options] : options;
  const [shown, setShown] = useState("select");
  const selectRef = useRef(null);
  const textRef = useRef(null);
  const previousRef = useRef("");
  // Both fields exist for a moment so focus moves straight from one to the other;
  // the student row must never see focus leave it and save half a row.
  function switchTo(next, focus) {
    if (focus) {
      flushSync(() => setShown("both"));
      (next === "text" ? textRef : selectRef).current?.focus();
    }
    setShown(next);
  }
  const classes = (extra) => [className, extra].filter(Boolean).join(" ");

  return (
    <>
      {shown !== "text" && (
        <select
          {...props}
          ref={selectRef}
          className={classes("staff-program-select")}
          value={current}
          onChange={(event) => {
            if (event.target.value !== NEW_PROGRAM) { onChange(event.target.value); return; }
            previousRef.current = current;
            onChange("");
            switchTo("text", true);
          }}
        >
          <option value="">Select a programme…</option>
          {list.map((option) => <option key={option} value={option}>{option}</option>)}
          <option value={NEW_PROGRAM}>+ Add a new programme…</option>
        </select>
      )}
      {shown !== "select" && (
        <input
          {...props}
          ref={textRef}
          className={classes("staff-program-new")}
          type="text"
          maxLength={300}
          placeholder="Type the new programme"
          value={current}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              // Stop the new-student row from clearing everything else too.
              event.stopPropagation();
              onChange(previousRef.current);
              switchTo("select", true);
            } else if (event.key === "Enter") {
              if (!current.trim()) onChange(previousRef.current);
              else if (current.trim() !== current) onChange(current.trim());
              switchTo("select", true);
            }
          }}
          onBlur={() => {
            if (shown === "both") return;
            if (!current.trim()) onChange(previousRef.current);
            else if (current.trim() !== current) onChange(current.trim());
            switchTo("select", false);
          }}
        />
      )}
    </>
  );
}
