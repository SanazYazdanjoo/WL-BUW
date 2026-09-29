import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useWorkspace } from "./useWorkspace";
import { staffRequest } from "./service";
import { canManage } from "./roles";
import { AUTOSAVE_TOGGLE_DELAY, useAutosave } from "./useAutosave";
import { SaveStatus } from "./SaveStatus";
import { STUDY_PROGRAM_OPTIONS } from "./studentOptions";

// One row per study programme, edited inline like the Students list. Coordinators and up edit;
// tutors see the same table read-only so they can share the WhatsApp link or QR code with students.
const COLUMNS = [
  { field: "tutor", label: "Tutor", max: 200, share: 14 },
  { field: "program", label: "Program", max: 300, list: "staff-tutors-program-options", share: 15 },
  { field: "contact", label: "Tutor Contact", max: 1000, share: 16, placeholder: "Email or phone" },
  { field: "whatsapp", label: "WhatsApp Link", max: 1000, share: 18, link: true, placeholder: "https://chat.whatsapp.com/…" },
  { field: "qrCode", label: "QR Code", share: 7, qr: true },
  { field: "note", label: "Note", max: 4000, share: 18 },
];
const TEXT_FIELDS = COLUMNS.filter((column) => !column.qr).map((column) => column.field);
const totalShare = COLUMNS.reduce((sum, column) => sum + column.share, 0);
// The save status and delete button keep 6%; the columns split the rest by share.
const width = (share) => `${(share / totalShare) * 94}%`;
const rowDraft = (row) => Object.fromEntries(COLUMNS.map(({ field }) => [field, String(row[field] ?? "")]));
const rowProblem = (draft) => (!draft.tutor.trim() && !draft.program.trim() ? "Enter a tutor or a programme." : "");
const qrUrl = (file) => `/api/staff/program-tutors/qr?file=${encodeURIComponent(file)}`;
const openableLink = (value) => /^https:\/\/\S+$/i.test(value.trim());

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

function QrCell({ row, qrCode, canEdit, onRemove, reload }) {
  const { session } = useOutletContext();
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ busy: false, error: "" });
  const who = row.program || row.tutor || "this row";
  useEffect(() => { if (open) dialogRef.current?.showModal(); }, [open]);
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setState({ busy: true, error: "" });
    try {
      const image = await imageForUpload(file);
      await staffRequest("program-tutors/qr", { csrf: session.csrf, body: { id: row.id, image } });
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
          <h2>{row.program || "QR code"}</h2>
          {row.tutor && <p className="staff-muted">Tutor: {row.tutor}</p>}
          <img src={qrUrl(qrCode)} alt={`WhatsApp QR code for ${who}`} />
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

// Hints only show in the empty "new row" at the bottom, so the saved rows stay calm.
function TextCell({ column: { field, label, max, list, link, placeholder }, draft, set, canEdit, who, tutorRef }) {
  return (
    <td data-field={field} data-label={label}>
      {canEdit ? (
        <div className={link ? "staff-cell-with-link" : undefined}>
          <input
            ref={field === "tutor" ? tutorRef : undefined}
            className="staff-cell-input"
            aria-label={`${label} · ${who}`}
            placeholder={!tutorRef ? "" : field === "tutor" ? "+ New tutor" : placeholder || ""}
            list={list}
            type={link ? "url" : "text"}
            maxLength={max}
            title={draft[field] || undefined}
            value={draft[field]}
            onChange={(e) => set(field, e.target.value)}
          />
          {link && openableLink(draft[field]) && <a className="staff-cell-open" href={draft[field].trim()} target="_blank" rel="noreferrer" aria-label={`Open WhatsApp link · ${who}`} title="Open link">↗</a>}
        </div>
      ) : link && openableLink(draft[field]) ? (
        <a className="staff-cell-text" href={draft[field].trim()} target="_blank" rel="noreferrer">{draft[field]}</a>
      ) : (
        <span className="staff-cell-text">{draft[field] || "—"}</span>
      )}
    </td>
  );
}

function TutorsListRow({ row, save, canEdit, onDelete, reload }) {
  const autosave = useAutosave(rowDraft(row), save, { validate: rowProblem });
  const who = autosave.draft.program || autosave.draft.tutor || "row";
  return (
    <tr>
      {COLUMNS.map((column) => column.qr
        ? <QrCell key={column.field} row={row} qrCode={autosave.draft.qrCode} canEdit={canEdit} reload={reload} onRemove={() => autosave.setField("qrCode", "", AUTOSAVE_TOGGLE_DELAY)} />
        : <TextCell key={column.field} column={column} draft={autosave.draft} set={autosave.setField} canEdit={canEdit} who={who} />)}
      <td className="staff-cell-status"><div className="staff-cell-status-inner">
        <SaveStatus {...autosave} onRetry={autosave.retry} onUseMine={() => autosave.resolveConflict(true)} onUseLatest={() => autosave.resolveConflict(false)} />
        {canEdit && <button type="button" className="staff-row-delete" title="Delete row…" aria-label={`Delete ${who}…`} onClick={() => onDelete(row)}>
          <svg aria-hidden="true" viewBox="0 0 16 16" width="15" height="15"><path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.8 6.5v4.5M9.2 6.5v4.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span className="staff-row-delete-text">Delete</span>
        </button>}
      </div></td>
    </tr>
  );
}

// Like the empty row under an Excel table: fill it in, then press Enter or leave the row.
function NewTutorsListRow({ onCreate }) {
  const blank = () => rowDraft({});
  const [draft, setDraft] = useState(blank);
  const [state, setState] = useState({ saving: false, error: "" });
  const tutorRef = useRef(null);
  const savingRef = useRef(false);
  const set = (field, value) => { setDraft((current) => ({ ...current, [field]: value })); setState((current) => ({ ...current, error: "" })); };
  const touched = TEXT_FIELDS.some((field) => draft[field].trim());
  async function create() {
    if (savingRef.current || !touched) return;
    const problem = rowProblem(draft);
    if (problem) { setState({ saving: false, error: problem }); return; }
    savingRef.current = true;
    setState({ saving: true, error: "" });
    const result = await onCreate(Object.fromEntries(TEXT_FIELDS.map((field) => [field, draft[field].trim()])));
    savingRef.current = false;
    if (result.ok) { setDraft(blank()); setState({ saving: false, error: "" }); tutorRef.current?.focus(); }
    else setState({ saving: false, error: result.error || "The row could not be added." });
  }
  return (
    <tr
      className="staff-new-student-row"
      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); create(); } if (event.key === "Escape") { setDraft(blank()); setState({ saving: false, error: "" }); } }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) create(); }}
    >
      {COLUMNS.map((column) => column.qr
        ? <td key={column.field} data-field="qrCode" data-label="QR Code" className="staff-cell-qr"><span className="staff-muted staff-qr-later">After adding</span></td>
        : <TextCell key={column.field} column={column} draft={draft} set={set} canEdit who="new row" tutorRef={tutorRef} />)}
      <td className="staff-cell-status">
        <div className="staff-autosave" aria-live="polite">
          {state.saving ? <span>Adding…</span> : state.error ? <span className="staff-autosave-error" role="alert">{state.error}</span> : touched ? <span>Press Enter to add</span> : null}
        </div>
      </td>
    </tr>
  );
}

function DeleteRowDialog({ row, onDelete, onClose }) {
  const dialogRef = useRef(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { dialogRef.current?.showModal(); }, []);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await onDelete(row);
    if (!result.ok) { setBusy(false); setError(result.error); }
  }
  return (
    <dialog ref={dialogRef} className="staff-delete-dialog" aria-labelledby="delete-tutors-row-title" onCancel={(event) => { if (busy) event.preventDefault(); }} onClose={onClose}>
      <form onSubmit={submit}>
        <h2 id="delete-tutors-row-title">Delete this row?</h2>
        <p className="staff-delete-student"><strong>{row.program || row.tutor}</strong>{row.program && row.tutor && <span>Tutor: {row.tutor}</span>}</p>
        <p>The row disappears from Program Tutors for all staff. A backup of the workbook is saved first, and the change log records who deleted it.</p>
        {error && <p className="staff-autosave-error" role="alert">{error}</p>}
        <div className="button-row">
          <button type="button" disabled={busy} onClick={() => dialogRef.current?.close()}>Cancel</button>
          <button type="submit" className="staff-danger-button" disabled={busy}>{busy ? "Deleting…" : "Delete row"}</button>
        </div>
      </form>
    </dialog>
  );
}

export default function ProgramTutorsPage() {
  const { session } = useOutletContext();
  const { workspace, error, autosave, reload } = useWorkspace();
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(null), [deleted, setDeleted] = useState("");
  useEffect(() => { if (!deleted) return undefined; const timer = setTimeout(() => setDeleted(""), 8000); return () => clearTimeout(timer); }, [deleted]);
  if (!workspace) return error ? <div className="staff-load-error" role="alert"><p><strong>{error}</strong></p><button type="button" className="primary" onClick={() => window.location.reload()}>Try again</button></div> : <p role="status">Loading Program Tutors…</p>;
  if (!workspace.tutorsList) return <div className="staff-page"><h1>Program Tutors</h1><p>Program Tutors needs the Welcome Lounge workbook. Ask a coordinator to create it on the Content page.</p></div>;
  const canEdit = canManage(session);
  async function createRow(fields) {
    try {
      await staffRequest("program-tutors/create", { csrf: session.csrf, body: fields });
      await reload();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  async function deleteRow(row) {
    try {
      await staffRequest("program-tutors/delete", { csrf: session.csrf, body: { id: row.id } });
      setDeleting(null);
      setDeleted(row.program || row.tutor);
      await reload();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  const needle = search.trim().toLowerCase();
  const rows = workspace.tutorsList.filter((row) => `${row.tutor} ${row.program} ${row.contact} ${row.note}`.toLowerCase().includes(needle));
  const programOptions = [...new Set([...STUDY_PROGRAM_OPTIONS, ...workspace.tutorsList.map((row) => row.program).filter(Boolean)])].sort((a, b) => a.localeCompare(b));
  return (
    <div className="staff-page staff-students-page staff-program-tutors-page">
      <header className="staff-page-heading staff-students-top">
        <h1>Program Tutors <span className="staff-count">{rows.length}</span></h1>
        <div className="staff-student-toolbar">
          <label className="staff-search">
            <span className="sr-only">Search Program Tutors</span>
            <input type="search" placeholder="Search tutor, program, contact or note" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
        </div>
      </header>
      <p className="staff-muted">{canEdit ? "Each programme's tutor and WhatsApp group. Changes save automatically to the workbook's Program Tutors tab." : "Each programme's tutor and WhatsApp group. Tap a QR code to show it large for a student to scan."}</p>
      <p className="staff-delete-notice" role="status">{deleted && <>Deleted {deleted}.</>}</p>
      <div className="table-scroll">
        <datalist id="staff-tutors-program-options">{programOptions.map((option) => <option key={option} value={option} />)}</datalist>
        <table aria-label="Program Tutors" className="staff-student-table staff-tutors-table">
          <thead>
            <tr>
              {COLUMNS.map(({ field, label, share }) => <th key={field} style={{ width: width(share) }}>{label}</th>)}
              <th className="staff-col-status" style={{ width: "6%" }}><span className="sr-only">Save status</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => <TutorsListRow key={row.id} row={row} canEdit={canEdit} reload={reload} onDelete={setDeleting} save={(patch, base) => autosave("program-tutors/update", row.id, patch, base)} />)}
            {canEdit && !needle && <NewTutorsListRow onCreate={createRow} />}
          </tbody>
        </table>
        {!rows.length && needle && <p className="staff-empty-state">No rows match “{search.trim()}”.</p>}
      </div>
      {deleting && <DeleteRowDialog row={deleting} onDelete={deleteRow} onClose={() => setDeleting(null)} />}
    </div>
  );
}
