import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { canonicalCountry, searchCountries } from "./studentOptions";

// Type-to-search country field. Finds everyday names, official names and
// aliases ("USA", "South Korea", "Persia"), works the same in every browser and
// still accepts free text. The list floats above the page so narrow table
// cells never clip it. Arrow keys move, Enter or Tab picks, Esc closes.
function Highlight({ text, query }) {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return text;
  return <>{text.slice(0, at)}<mark>{text.slice(at, at + query.length)}</mark>{text.slice(at + query.length)}</>;
}

function listPosition(input) {
  const r = input.getBoundingClientRect();
  const width = Math.min(Math.max(r.width, 240), window.innerWidth - 16);
  const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
  const below = window.innerHeight - r.bottom - 8;
  const above = r.top - 8;
  const up = below < 200 && above > below;
  const maxHeight = Math.max(120, Math.min(288, (up ? above : below) - 4));
  return up ? { left, width, maxHeight, bottom: window.innerHeight - r.top + 4 } : { left, width, maxHeight, top: r.bottom + 4 };
}

export function CountryInput({ value, onChange, className, maxLength = 200, ...inputProps }) {
  const inputRef = useRef(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [browseAll, setBrowseAll] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState(null);
  const text = value || "";
  const options = useMemo(() => searchCountries(browseAll ? "" : text), [browseAll, text]);
  const optionId = (index) => `${listId}-option-${index}`;

  // Opened on a filled-in field: show the whole list with the current country marked.
  function show() {
    const all = !text.trim() || searchCountries(text).some((option) => option.name === text);
    const list = searchCountries(all ? "" : text);
    setBrowseAll(all);
    setActive(all ? list.findIndex((option) => option.name === text) : list[0]?.prefix ? 0 : -1);
    setOpen(true);
  }
  function choose(name) {
    onChange(name);
    setOpen(false);
  }
  const pending = open && active >= 0 && options[active] && options[active].name !== text ? options[active] : null;

  function onKeyDown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) show();
      else setActive((current) => Math.max(0, Math.min(options.length - 1, current + (event.key === "ArrowDown" ? 1 : -1))));
    } else if (event.key === "Enter") {
      // Stop the row's own Enter ("add student") only when this Enter picks a country.
      if (pending) { event.preventDefault(); event.stopPropagation(); choose(pending.name); }
      else setOpen(false);
    } else if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === "Tab" && pending && !browseAll) {
      choose(pending.name);
    }
  }

  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => inputRef.current && setPosition(listPosition(inputRef.current));
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
  }, [open]);
  useEffect(() => {
    if (open && active >= 0) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
  });

  return (
    <>
      <input
        {...inputProps}
        ref={inputRef}
        className={[className, "staff-combo-input"].filter(Boolean).join(" ")}
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        maxLength={maxLength}
        value={text}
        onChange={(event) => {
          const list = searchCountries(event.target.value);
          onChange(event.target.value);
          setBrowseAll(false);
          setActive(list[0]?.prefix ? 0 : -1);
          setOpen(true);
        }}
        onClick={() => { if (!open) show(); }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setOpen(false);
          // "usa" or "germany" typed by hand is saved as "United States" / "Germany".
          const standard = canonicalCountry(text);
          if (standard && standard !== text) onChange(standard);
        }}
      />
      {open && position && createPortal(
        // mousedown would blur the input before the click lands; keep focus in the field.
        <ul id={listId} role="listbox" aria-label="Countries" className="staff-combo-list" style={position} onMouseDown={(event) => event.preventDefault()}>
          {options.length ? options.map((option, index) => (
            <li
              key={option.name}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              className={option.name === text ? "is-current" : undefined}
              onClick={() => choose(option.name)}
            >
              <span><Highlight text={option.name} query={browseAll ? "" : text.trim()} /></span>
              {option.alias && <small>{option.alias}</small>}
            </li>
          )) : <li className="staff-combo-empty" role="presentation">No country matches “{text.trim()}”. It will be saved as typed.</li>}
        </ul>,
        document.body,
      )}
    </>
  );
}
