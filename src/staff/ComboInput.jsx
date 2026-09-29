import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { foldText } from "./studentOptions";

// Type-to-search field with a list to pick from (countries, study programmes).
// With a mouse the list floats under the field: arrow keys move, Enter or Tab
// picks, Esc closes. On touch screens a tap opens a full-screen picker instead,
// because a floating list ends up under the phone's keyboard. Free text is
// always accepted.
const TOUCH_QUERY = "(pointer: coarse)";

function useTouchScreen() {
  const [touch, setTouch] = useState(() => Boolean(window.matchMedia?.(TOUCH_QUERY).matches));
  useEffect(() => {
    const media = window.matchMedia?.(TOUCH_QUERY);
    if (!media) return undefined;
    const update = () => setTouch(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  return touch;
}

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

// Full-screen list for phones and tablets. It fits the part of the screen the
// keyboard leaves free, and keeps its keys and focus changes away from the
// student row (Enter there adds a student, Esc clears the new row).
function PickerSheet({ title, value, search, canonical, maxLength, onClose }) {
  const dialogRef = useRef(null);
  const pickedRef = useRef(null);
  const [query, setQuery] = useState("");
  const [box, setBox] = useState({});
  const options = useMemo(() => search(query), [search, query]);
  const typed = query.trim();
  const exact = typed && options.some((option) => foldText(option.name) === foldText(typed));

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    dialog.querySelector(".is-current")?.scrollIntoView({ block: "center" });
    const viewport = window.visualViewport;
    const fit = () => viewport && setBox({ "--sheet-top": `${viewport.offsetTop}px`, "--sheet-height": `${viewport.height}px` });
    fit();
    viewport?.addEventListener("resize", fit);
    viewport?.addEventListener("scroll", fit);
    return () => {
      viewport?.removeEventListener("resize", fit);
      viewport?.removeEventListener("scroll", fit);
      if (dialog.open) dialog.close();
    };
  }, []);

  function pick(name) {
    pickedRef.current = name;
    dialogRef.current.close();
  }
  const stop = (event) => event.stopPropagation();

  return createPortal(
    <dialog
      ref={dialogRef}
      className="staff-combo-sheet"
      aria-label={title}
      style={box}
      onClose={() => onClose(pickedRef.current)}
      onKeyDown={stop}
      onFocus={stop}
      onBlur={stop}
      onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current.close(); }}
    >
      <div className="staff-combo-sheet-head">
        <strong>{title}</strong>
        {value && <button type="button" onClick={() => pick("")}>Clear</button>}
        <button type="button" onClick={() => dialogRef.current.close()}>Cancel</button>
      </div>
      <input
        type="search"
        className="staff-combo-sheet-search"
        aria-label={`Search ${title.toLowerCase()}`}
        placeholder="Type to search…"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        maxLength={maxLength}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || !typed) return;
          event.preventDefault();
          pick(options[0]?.prefix ? options[0].name : canonical?.(typed) || typed);
        }}
      />
      <ul role="listbox" aria-label={title} className="staff-combo-sheet-list">
        {typed && !exact && (
          <li role="option" aria-selected="false">
            <button type="button" className="staff-combo-sheet-typed" onClick={() => pick(canonical?.(typed) || typed)}>Use “{typed}”</button>
          </li>
        )}
        {options.map((option) => (
          <li key={option.name} role="option" aria-selected={option.name === value} className={option.name === value ? "is-current" : undefined}>
            <button type="button" onClick={() => pick(option.name)}>
              <span><Highlight text={option.name} query={typed} /></span>
              {option.alias && <small>{option.alias}</small>}
            </button>
          </li>
        ))}
      </ul>
    </dialog>,
    document.body,
  );
}

export function ComboInput({ value, onChange, search, canonical, title, noMatch, className, maxLength = 200, ...inputProps }) {
  const touch = useTouchScreen();
  const inputRef = useRef(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [browseAll, setBrowseAll] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState(null);
  const text = value || "";
  const options = useMemo(() => search(browseAll ? "" : text), [search, browseAll, text]);
  const optionId = (index) => `${listId}-option-${index}`;
  const classes = [className, "staff-combo-input"].filter(Boolean).join(" ");

  // Opened on a filled-in field: show the whole list with the current value marked.
  function show() {
    const all = !text.trim() || search(text).some((option) => option.name === text);
    const list = search(all ? "" : text);
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
      // Stop the row's own Enter ("add student") only when this Enter picks an option.
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

  if (touch) {
    return (
      <>
        <input
          {...inputProps}
          ref={inputRef}
          className={classes}
          type="text"
          readOnly
          aria-haspopup="dialog"
          value={text}
          onClick={() => setSheet(true)}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") { event.preventDefault(); event.stopPropagation(); setSheet(true); } }}
        />
        {sheet && (
          <PickerSheet
            title={title}
            value={text}
            search={search}
            canonical={canonical}
            maxLength={maxLength}
            onClose={(picked) => {
              if (picked !== null && picked !== text) onChange(picked);
              inputRef.current?.focus({ preventScroll: true });
              setSheet(false);
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <input
        {...inputProps}
        ref={inputRef}
        className={classes}
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
          const list = search(event.target.value);
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
          const standard = canonical?.(text);
          if (standard && standard !== text) onChange(standard);
        }}
      />
      {open && position && createPortal(
        // mousedown would blur the input before the click lands; keep focus in the field.
        <ul id={listId} role="listbox" aria-label={title} className="staff-combo-list" style={position} onMouseDown={(event) => event.preventDefault()}>
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
          )) : <li className="staff-combo-empty" role="presentation">{noMatch(text.trim())}</li>}
        </ul>,
        document.body,
      )}
    </>
  );
}
