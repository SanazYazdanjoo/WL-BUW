import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useWorkspace } from "./useWorkspace";
import { staffRequest } from "./service";
import { canManage } from "./roles";
import { AUTOSAVE_TOGGLE_DELAY, useAutosave } from "./useAutosave";
import { SaveStatus } from "./SaveStatus";

// Every tutor — programme tutors and the Welcome Lounge team — grouped by faculty, edited inline
// like the Students list. Coordinators and up edit; tutors see it read-only.
const COLUMNS = [
  { field: "program", label: "Program", max: 300, share: 15 },
  { field: "tutor", label: "Tutor", max: 200, share: 15 },
  { field: "email", label: "Email", max: 500, share: 19, kind: "email" },
  { field: "phone", label: "Phone", max: 200, share: 11, kind: "phone" },
  { field: "whatsapp", label: "WhatsApp Link", max: 1000, share: 14, kind: "link", placeholder: "https://chat.whatsapp.com/…" },
  { field: "qrCode", label: "QR Code", share: 6, qr: true },
  { field: "note", label: "Note", max: 4000, share: 14 },
];
const TEXT_FIELDS = COLUMNS.filter((column) => !column.qr).map((column) => column.field);
const totalShare = COLUMNS.reduce((sum, column) => sum + column.share, 0);
// The save status and delete button keep 6%; the columns split the rest by share.
const width = (share) => `${(share / totalShare) * 94}%`;
const rowDraft = (row) => Object.fromEntries(COLUMNS.map(({ field }) => [field, String(row[field] ?? "")]));
const rowProblem = (draft) => (!draft.tutor.trim() && !draft.program.trim() ? "Enter a tutor or a programme." : "");
const qrUrl = (file) => `/api/staff/all-tutors/qr?file=${encodeURIComponent(file)}`;
const openableLink = (value) => /^https:\/\/\S+$/i.test(value.trim());
const groupName = (faculty) => faculty || "Other";

// Rows in stored order, grouped by faculty in the order the faculties first appear.
function groupByFaculty(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.faculty)) groups.set(row.faculty, []);
    groups.get(row.faculty).push(row);
  }
  return [...groups.entries()].map(([faculty, list]) => ({ faculty, rows: list }));
}

// Phone photos are large: scale the image down in the browser so the upload stays small.
// QR codes stay sharp as PNG; a photo that is still too big is sent as JPEG.
const MAX_UPLOAD_CHARS = 118000;
async function imageForUpload(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Choose a PNG, JPG or WebP image.");
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("This image could not be opened.")); img.src = url; });
    for (const side of [512, 400, 300]) {
      const scale = Math.min(1, side / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const encoded of [canvas.toDataURL("image/png"), canvas.toDataURL("image/jpeg", 0.9), canvas.toDataURL("image/jpeg", 0.75)])
        if (encoded.length <= MAX_UPLOAD_CHARS) return encoded;
    }
    throw new Error("The image is too large. Use a smaller picture of the QR code.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
const fileAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
  reader.onerror = () => reject(new Error("The file could not be read."));
  reader.readAsDataURL(file);
});

function QrCell({ row, qrCode, canEdit, onRemove, reload }) {
  const { session } = useOutletContext();
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ busy: false, error: "" });
  const who = row.tutor || row.program || "this row";
  useEffect(() => { if (open) dialogRef.current?.showModal(); }, [open]);
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setState({ busy: true, error: "" });
    try {
      const image = await imageForUpload(file);
      await staffRequest("all-tutors/qr", { csrf: session.csrf, body: { id: row.id, image } });
      await reload();
      setState({ busy: false, error: "" });
    } catch (error) {
      setState({ busy: false, error: error.message || "The image could not be uploaded." });
    }
  }
  return (
    <td data-field="qrCode" data-label="QR Code" className="staff-cell-qr">
      <div className="staff-qr">
        {qrCode ? (
          <button type="button" className="staff-qr-thumb" aria-label={`Show QR code · ${who}`} onClick={() => setOpen(true)}>
            <img src={qrUrl(qrCode)} alt="" width="36" height="36" loading="lazy" />
          </button>
        ) : canEdit ? (
          <button type="button" className="staff-qr-upload" disabled={state.busy} aria-label={`Upload QR code · ${who}`} onClick={() => inputRef.current?.click()}>{state.busy ? "Uploading…" : "+ Upload"}</button>
        ) : <span className="staff-muted">—</span>}
        {canEdit && <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={upload} />}
      </div>
      {state.error && <span className="staff-autosave-error" role="alert">{state.error}</span>}
      {open && qrCode && (
        <dialog ref={dialogRef} className="staff-qr-dialog" aria-label={`QR code · ${who}`} onClose={() => setOpen(false)} onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current.close(); }}>
          <h2>{row.program || row.tutor || "QR code"}</h2>
          {row.tutor && row.program && <p className="staff-muted">Tutor: {row.tutor}</p>}
          <img src={qrUrl(qrCode)} alt={`WhatsApp QR code · ${who}`} />
          <div className="button-row">
            <a className="staff-export-link" href={qrUrl(qrCode)} download={`QR ${who}.${qrCode.split(".").pop()}`}>Download</a>
            {canEdit && <button type="button" disabled={state.busy} onClick={() => { dialogRef.current?.close(); inputRef.current?.click(); }}>Replace</button>}
            {canEdit && <button type="button" className="content-delete-button" onClick={() => { onRemove(); dialogRef.current?.close(); }}>Remove</button>}
            <button type="button" onClick={() => dialogRef.current?.close()}>Close</button>
          </div>
        </dialog>
      )}
    </td>
  );
}

// Hints only show in a row being added, so the saved rows stay calm.
function TextCell({ column: { field, label, max, kind, placeholder }, draft, set, canEdit, who, firstRef, repeat }) {
  const value = draft[field];
  const readOnly = kind === "link" && openableLink(value) ? <a className="staff-cell-text" href={value.trim()} target="_blank" rel="noreferrer">{value}</a>
    : kind === "email" && value.includes("@") ? <a className="staff-cell-text" href={`mailto:${value.split(/[;,\s]+/)[0]}`}>{value}</a>
    : <span className="staff-cell-text">{value || "—"}</span>;
  return (
    <td data-field={field} data-label={label} className={repeat ? "is-repeat" : undefined}>
      {canEdit ? (
        <div className={kind === "link" ? "staff-cell-with-link" : undefined}>
          <input
            ref={field === "program" ? firstRef : undefined}
            className="staff-cell-input"
            aria-label={`${label} · ${who}`}
            placeholder={!firstRef ? "" : field === "tutor" ? "Name" : placeholder || ""}
            type={kind === "link" ? "url" : kind === "email" ? "email" : kind === "phone" ? "tel" : "text"}
            maxLength={max}
            title={value || undefined}
            value={value}
            onChange={(e) => set(field, e.target.value)}
          />
          {kind === "link" && openableLink(value) && <a className="staff-cell-open" href={value.trim()} target="_blank" rel="noreferrer" aria-label={`Open WhatsApp link · ${who}`} title="Open link">↗</a>}
        </div>
      ) : readOnly}
    </td>
  );
}

function TutorRow({ row, previous, save, canEdit, onDelete, reload }) {
  const autosave = useAutosave(rowDraft(row), save, { validate: rowProblem });
  const who = autosave.draft.tutor || autosave.draft.program || "row";
  return (
    <tr>
      {COLUMNS.map((column) => column.qr
        ? <QrCell key={column.field} row={row} qrCode={autosave.draft.qrCode} canEdit={canEdit} reload={reload} onRemove={() => autosave.setField("qrCode", "", AUTOSAVE_TOGGLE_DELAY)} />
        // Like the printed list: a programme repeated from the row above is shown faintly.
        : <TextCell key={column.field} column={column} draft={autosave.draft} set={autosave.setField} canEdit={canEdit} who={who} repeat={column.field === "program" && Boolean(previous?.program) && previous.program === autosave.draft.program} />)}
      <td className="staff-cell-status"><div className="staff-cell-status-inner">
        <SaveStatus {...autosave} onRetry={autosave.retry} onUseMine={() => autosave.resolveConflict(true)} onUseLatest={() => autosave.resolveConflict(false)} />
        {canEdit && <button type="button" className="staff-row-delete" title="Delete tutor…" aria-label={`Delete ${who}…`} onClick={() => onDelete(row)}>
          <svg aria-hidden="true" viewBox="0 0 16 16" width="15" height="15"><path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.8 6.5v4.5M9.2 6.5v4.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span className="staff-row-delete-text">Delete</span>
        </button>}
      </div></td>
    </tr>
  );
}

// Opened from a group's "+ Add tutor": fill it in, then press Enter or leave the row. It stays open for the next one.
function NewTutorRow({ faculty, program, onCreate, onClose }) {
  const blank = () => ({ ...rowDraft({}), program });
  const [draft, setDraft] = useState(blank);
  const [state, setState] = useState({ saving: false, error: "" });
  const firstRef = useRef(null);
  const savingRef = useRef(false);
  useEffect(() => { firstRef.current?.focus(); }, []);
  const set = (field, value) => { setDraft((current) => ({ ...current, [field]: value })); setState((current) => ({ ...current, error: "" })); };
  const touched = TEXT_FIELDS.some((field) => field !== "program" && draft[field].trim());
  async function create() {
    if (savingRef.current || !touched) return;
    const problem = rowProblem(draft);
    if (problem) { setState({ saving: false, error: problem }); return; }
    savingRef.current = true;
    setState({ saving: true, error: "" });
    const result = await onCreate({ faculty, ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, draft[field].trim()])) });
    savingRef.current = false;
    if (result.ok) { setDraft({ ...rowDraft({}), program: draft.program }); setState({ saving: false, error: "" }); firstRef.current?.focus(); }
    else setState({ saving: false, error: result.error || "The tutor could not be added." });
  }
  return (
    <tr
      className="staff-new-student-row"
      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); create(); } if (event.key === "Escape") onClose(); }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) create(); }}
    >
      {COLUMNS.map((column) => column.qr
        ? <td key={column.field} data-field="qrCode" data-label="QR Code" className="staff-cell-qr"><span className="staff-muted staff-qr-later">After adding</span></td>
        : <TextCell key={column.field} column={column} draft={draft} set={set} canEdit who="new tutor" firstRef={firstRef} />)}
      <td className="staff-cell-status">
        <div className="staff-autosave" aria-live="polite">
          {state.saving ? <span>Adding…</span> : state.error ? <span className="staff-autosave-error" role="alert">{state.error}</span> : touched ? <span>Press Enter to add</span> : null}
          <button type="button" className="staff-qr-upload" onClick={onClose}>Done</button>
        </div>
      </td>
    </tr>
  );
}

function DeleteRowDialog({ row, onDelete, onClose }) {
  const dialogRef = useRef(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { dialogRef.current?.showModal(); }, []);
  const details = [row.tutor ? row.program : "", row.faculty].filter(Boolean).join(" · ");
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await onDelete(row);
    if (!result.ok) { setBusy(false); setError(result.error); }
  }
  return (
    <dialog ref={dialogRef} className="staff-delete-dialog" aria-labelledby="delete-tutor-title" onCancel={(event) => { if (busy) event.preventDefault(); }} onClose={onClose}>
      <form onSubmit={submit}>
        <h2 id="delete-tutor-title">Delete this tutor?</h2>
        <p className="staff-delete-student"><strong>{row.tutor || row.program}</strong>{details && <span>{details}</span>}</p>
        <p>The row disappears from All Tutors for all staff. A backup of the workbook is saved first, and the change log records who deleted it.</p>
        {error && <p className="staff-autosave-error" role="alert">{error}</p>}
        <div className="button-row">
          <button type="button" disabled={busy} onClick={() => dialogRef.current?.close()}>Cancel</button>
          <button type="submit" className="staff-danger-button" disabled={busy}>{busy ? "Deleting…" : "Delete tutor"}</button>
        </div>
      </form>
    </dialog>
  );
}

// Replacing the whole list from an Excel file is deliberate: pick the file, then confirm.
function ImportDialog({ file, count, onImport, onClose }) {
  const dialogRef = useRef(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { dialogRef.current?.showModal(); }, []);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await onImport(file);
    if (result.ok) dialogRef.current?.close();
    else { setBusy(false); setError(result.error); }
  }
  return (
    <dialog ref={dialogRef} className="staff-delete-dialog" aria-labelledby="import-tutors-title" onCancel={(event) => { if (busy) event.preventDefault(); }} onClose={onClose}>
      <form onSubmit={submit}>
        <h2 id="import-tutors-title">Replace the tutor list?</h2>
        <p className="staff-delete-student"><strong>{file.name}</strong></p>
        <p>The {count} rows now in All Tutors are replaced by the rows in this file (a sheet with Faculty, Program, Tutor, Email, Phone, WhatsApp Link and Note headings). Tutors already listed with the same name and programme keep their QR code. A backup of the workbook is saved first.</p>
        {error && <p className="staff-autosave-error" role="alert">{error}</p>}
        <div className="button-row">
          <button type="button" disabled={busy} onClick={() => dialogRef.current?.close()}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? "Importing…" : "Replace list"}</button>
        </div>
      </form>
    </dialog>
  );
}

export default function AllTutorsPage() {
  const { session } = useOutletContext();
  const { workspace, error, autosave, reload } = useWorkspace();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(null);
  const [newGroup, setNewGroup] = useState(null);
  const [deleting, setDeleting] = useState(null), [importing, setImporting] = useState(null), [notice, setNotice] = useState("");
  const importRef = useRef(null);
  useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(""), 10000); return () => clearTimeout(timer); }, [notice]);
  if (!workspace) return error ? <div className="staff-load-error" role="alert"><p><strong>{error}</strong></p><button type="button" className="primary" onClick={() => window.location.reload()}>Try again</button></div> : <p role="status">Loading All Tutors…</p>;
  if (!workspace.tutorsList) return <div className="staff-page"><h1>All Tutors</h1><p>All Tutors needs the Welcome Lounge workbook. Ask a coordinator to create it on the Content page.</p></div>;
  const canEdit = canManage(session);
  async function createRow(fields) {
    try {
      await staffRequest("all-tutors/create", { csrf: session.csrf, body: fields });
      await reload();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  async function deleteRow(row) {
    try {
      await staffRequest("all-tutors/delete", { csrf: session.csrf, body: { id: row.id } });
      setDeleting(null);
      setNotice(`Deleted ${row.tutor || row.program}.`);
      await reload();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  async function importFile(file) {
    try {
      const data = await fileAsBase64(file);
      if (data.length > 120000) return { ok: false, error: "The file is too large. Keep only the tutor list in it." };
      const result = await staffRequest("all-tutors/import", { csrf: session.csrf, body: { file: data } });
      setNotice(`Imported ${result.count} tutors.`);
      await reload();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  const needle = search.trim().toLowerCase();
  const rows = workspace.tutorsList.filter((row) => `${row.faculty} ${row.program} ${row.tutor} ${row.email} ${row.phone} ${row.note}`.toLowerCase().includes(needle));
  const groups = groupByFaculty(rows);
  // A group being started from "+ New group" shows up empty until its first tutor is added.
  if (adding !== null && !groups.some((group) => group.faculty === adding)) groups.push({ faculty: adding, rows: [] });
  return (
    <div className="staff-page staff-students-page staff-all-tutors-page">
      <header className="staff-page-heading staff-students-top">
        <h1>All Tutors <span className="staff-count">{rows.length}</span></h1>
        <div className="staff-student-toolbar">
          <label className="staff-search">
            <span className="sr-only">Search All Tutors</span>
            <input type="search" placeholder="Search name, program, faculty, email or note" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          {canEdit && <>
            <button type="button" onClick={() => importRef.current?.click()}>Import from Excel…</button>
            <input ref={importRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) setImporting(file); }} />
          </>}
        </div>
      </header>
      <p className="staff-muted">{canEdit ? "Programme tutors and the Welcome Lounge team, by faculty. Changes save automatically to the workbook's All Tutors tab." : "Programme tutors and the Welcome Lounge team, by faculty. Tap a QR code to show it large for a student to scan."}</p>
      <p className="staff-delete-notice" role="status">{notice}</p>
      <div className="table-scroll">
        <table aria-label="All Tutors" className="staff-student-table staff-tutors-table">
          <thead>
            <tr>
              {COLUMNS.map(({ field, label, share }) => <th key={field} style={{ width: width(share) }}>{label}</th>)}
              <th className="staff-col-status" style={{ width: "6%" }}><span className="sr-only">Save status</span></th>
            </tr>
          </thead>
          {groups.map(({ faculty, rows: list }) => (
            <tbody key={faculty}>
              <tr className="staff-group-row">
                <th colSpan={COLUMNS.length + 1} scope="colgroup"><div className="staff-group-head">
                  <span className="staff-group-title">{groupName(faculty)} <span className="staff-count">{list.length}</span></span>
                  {canEdit && adding !== faculty && <button type="button" className="staff-qr-upload" onClick={() => { setSearch(""); setAdding(faculty); }}>+ Add tutor</button>}
                </div></th>
              </tr>
              {list.map((row, index) => <TutorRow key={row.id} row={row} previous={list[index - 1]} canEdit={canEdit} reload={reload} onDelete={setDeleting} save={(patch, base) => autosave("all-tutors/update", row.id, patch, base)} />)}
              {canEdit && adding === faculty && <NewTutorRow faculty={faculty} program={list.at(-1)?.program || ""} onCreate={createRow} onClose={() => setAdding(null)} />}
            </tbody>
          ))}
        </table>
        {!rows.length && (needle ? <p className="staff-empty-state">No tutors match “{search.trim()}”.</p> : adding === null && <p className="staff-empty-state">No tutors yet.{canEdit && " Import the list from Excel, or start a group below."}</p>)}
      </div>
      {canEdit && !needle && (newGroup === null
        ? <button type="button" className="staff-qr-upload staff-new-group" onClick={() => setNewGroup("")}>+ New group</button>
        : <form className="staff-new-group-form" onSubmit={(event) => { event.preventDefault(); const name = newGroup.trim(); if (name) { setAdding(name); setNewGroup(null); } }}>
          <label>Group name<input autoFocus maxLength={200} value={newGroup} placeholder="e.g. Fakultät Medien" onChange={(e) => setNewGroup(e.target.value)} /></label>
          <button type="submit" className="primary" disabled={!newGroup.trim()}>Add tutor to this group</button>
          <button type="button" onClick={() => setNewGroup(null)}>Cancel</button>
        </form>)}
      {deleting && <DeleteRowDialog row={deleting} onDelete={deleteRow} onClose={() => setDeleting(null)} />}
      {importing && <ImportDialog file={importing} count={workspace.tutorsList.length} onImport={importFile} onClose={() => setImporting(null)} />}
    </div>
  );
}
