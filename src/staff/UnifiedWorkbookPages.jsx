import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { staffRequest } from "./service";
import { AUTOSAVE_TOGGLE_DELAY, useAutosave } from "./useAutosave";
import { SaveStatus } from "./SaveStatus";

const sections = ["First Step", "Useful Info", "Student Support", "Community", "Help"];
const emptyItem = () => ({ section: "First Step", order: 1, title: "", text: "", link: "", active: true });

function ContentItemEditor({ item, save, onDone }) {
  const autosave = useAutosave({ title: item.title, text: item.text, link: item.link || "", order: item.order, active: item.active }, save, {
    validate(draft) {
      if (!draft.title.trim()) return "Enter a title before saving.";
      if (!draft.text.trim()) return "Enter a short text before saving.";
      if (!Number.isInteger(Number(draft.order)) || Number(draft.order) < 1 || Number(draft.order) > 10000) return "Order must be a positive whole number.";
      if (draft.link && !/^https:\/\/[^\s]+$/i.test(draft.link)) return "Enter a complete HTTPS link.";
      return "";
    },
  });
  const set = (field, value, delay) => autosave.setField(field, value, delay);
  return <section className="staff-dashboard-section" aria-labelledby="content-edit-heading">
    <h2 id="content-edit-heading">Edit item</h2>
    <div className="staff-form">
      <div className="staff-autosave-position"><SaveStatus {...autosave} onRetry={autosave.retry} onUseMine={() => autosave.resolveConflict(true)} onUseLatest={() => autosave.resolveConflict(false)} /></div>
      <label>Section<select value={item.section} disabled>{sections.map((section) => <option key={section}>{section}</option>)}</select></label>
      <label>Order<input type="number" min="1" max="10000" required value={autosave.draft.order} onChange={(e) => set("order", Number(e.target.value))} /></label>
      <label>Title<input required maxLength={200} value={autosave.draft.title} onChange={(e) => set("title", e.target.value)} /></label>
      <label>Short text<textarea required maxLength={12000} value={autosave.draft.text} onChange={(e) => set("text", e.target.value)} /></label>
      <label>Primary link<input type="url" placeholder="https://" value={autosave.draft.link} onChange={(e) => set("link", e.target.value)} /></label>
      <label className="checkbox-label"><input type="checkbox" checked={autosave.draft.active} onChange={(e) => set("active", e.target.checked, AUTOSAVE_TOGGLE_DELAY)} />Active</label>
      <button type="button" disabled={autosave.hasUnsavedChanges || autosave.status === "saving" || autosave.status === "error" || autosave.status === "conflict"} onClick={onDone}>Close editor</button>
    </div>
  </section>;
}

export function ContentManagementPage() {
  const { session, refreshRoster } = useOutletContext();
  const [data, setData] = useState(null), [status, setStatus] = useState(null), [form, setForm] = useState(null), [staffForm, setStaffForm] = useState(null), [settingsForm, setSettingsForm] = useState(null), [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    try {
      const [content, workbookStatus] = await Promise.all([staffRequest("content"), staffRequest("workbook/status")]);
      setData(content.items ? content : null);
      setSettingsForm(content.settings || null);
      setStatus(workbookStatus);
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([staffRequest("content"), staffRequest("workbook/status")]).then(([content, workbookStatus]) => {
      if (!active) return;
      setData(content.items ? content : null);
      setSettingsForm(content.settings || null);
      setStatus(workbookStatus);
    }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  async function save(action, body, savedMessage) {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await staffRequest(action, { csrf: session.csrf, body: { ...body, etag: data?.etag } });
      setMessage(savedMessage || "Saved.");
      setForm(null); setStaffForm(null);
      await reload();
      if (action === "staff/save") await refreshRoster?.();
      if (action === "settings/save") window.dispatchEvent(new Event("staff-semester-updated"));
      return result;
    } catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }
  async function autosaveContent(id, patch, base) {
    const result = await staffRequest("content/autosave", { csrf: session.csrf, body: { id, patch, base, etag: data?.etag } });
    await reload();
    return result;
  }
  if (error && !status) return <div className="staff-page"><h1>Content</h1><p role="alert">{error}</p><button onClick={reload}>Retry</button></div>;
  if (!status) return <p role="status">Loading workbook status…</p>;
  if (!data) return <div className="staff-page"><p className="staff-eyebrow">COORDINATOR · CONTENT</p><h1>Content</h1>{status.workbook === "missing" ? <section className="staff-dashboard-section"><h2>Upload the operational workbook</h2><p>Upload <strong>Welcome-Lounge.xlsx</strong> to the root of the configured Nextcloud app folder. Then refresh this page; the app will read it automatically.</p><p>This is separate from <strong>content-source/Welcome-Lounge-Content.xlsx</strong>, which contains public student information.</p></section> : <p>{status.workbook === "not-configured" ? "Unified workbook detection is disabled for this deployment." : status.workbook === "invalid" ? "Welcome-Lounge.xlsx was found but could not be read. Check that it is the operational workbook and that the configured Nextcloud account can access it." : "Welcome-Lounge.xlsx is not available. Check that it is uploaded to the configured Nextcloud app folder and that the app has access."}</p>}{error && <p role="alert">{error}</p>}<button type="button" onClick={reload}>Refresh workbook status</button></div>;
  const items = data.items;
  return <div className="staff-page staff-content-page">
    <header className="staff-page-heading"><p className="staff-eyebrow">COORDINATOR · CONTENT</p><h1>Content</h1><p className="staff-page-lead">Changes save automatically. They appear on the student site after the next request.</p></header>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    {data.warnings?.length > 0 && <aside className="content-history" aria-label="Review required">{data.warnings.map((warning) => <p key={warning}>{warning}</p>)}</aside>}
    {data.idAssignments?.length > 0 && <p className="staff-muted">{data.idAssignments.length} new content ID{data.idAssignments.length === 1 ? "" : "s"} will be saved automatically with the next workbook update.</p>}
    <section className="semester-status" aria-labelledby="unified-file-heading"><h2 id="unified-file-heading">Welcome Lounge workbook</h2><p>{data.sourceFilename} · {statusDate(status.lastModified)}</p><p>Nextcloud: {status.connected ? "Connected" : "Connection problem"} · Workbook: {status.workbook}</p><p>Last backup: {statusDate(data.lastBackup)}</p><div className="semester-actions"><a href="/api/staff/workbook/download">Download workbook</a><a href="/api/staff/workbook/backup" onClick={async (event) => { event.preventDefault(); await save("workbook/backup", {}, "Backup created."); }}>Create backup</a></div></section>
    <section className="staff-dashboard-section"><h2>Semester and support</h2>{settingsForm && <form className="staff-form" onSubmit={(event) => { event.preventDefault(); save("settings/save", settingsForm, "Settings saved."); }}>
      <label>Semester<input required maxLength={100} value={settingsForm.semesterLabel || ""} onChange={(e) => setSettingsForm({ ...settingsForm, semesterLabel: e.target.value })} /></label>
      <label>WhatsApp group URL<input type="url" placeholder="https://chat.whatsapp.com/..." value={settingsForm.whatsappGroupUrl || ""} onChange={(e) => setSettingsForm({ ...settingsForm, whatsappGroupUrl: e.target.value })} /></label>
      <label className="checkbox-label"><input type="checkbox" checked={settingsForm.whatsappEnabled === true} onChange={(e) => setSettingsForm({ ...settingsForm, whatsappEnabled: e.target.checked })} />WhatsApp enabled</label>
      <label>Last reviewed<input type="date" value={settingsForm.contentReviewedDate || ""} onChange={(e) => setSettingsForm({ ...settingsForm, contentReviewedDate: e.target.value })} /></label>
      <button className="primary" disabled={busy}>Save settings</button>
    </form>}</section>
    <section className="staff-dashboard-section"><h2>Student-facing items</h2><p>One item per row. IDs stay behind the scenes and are created automatically.</p><button type="button" onClick={() => setForm({ ...emptyItem(), order: Math.max(0, ...items.filter((item) => item.section === "First Step").map((item) => item.order)) + 1 })}>Add content item</button>
      {sections.map((section) => <section className="content-history" key={section}><h3>{section}</h3>{items.filter((item) => item.section === section).sort((a, b) => a.order - b.order).map((item) => <article className="staff-record-history" key={item.id}><strong>{item.order}. {item.title}</strong><p>{item.text}</p><small>{item.active ? "Active" : "Inactive"}{item.link ? ` · ${item.link}` : ""}</small><div className="button-row"><button type="button" onClick={() => setForm({ ...item })}>Edit</button><button type="button" disabled={busy} onClick={() => save("content/save", { item: { ...item, active: !item.active } }, item.active ? "Item deactivated." : "Item activated.")}>{item.active ? "Deactivate" : "Activate"}</button></div></article>)}</section>)}
    </section>
    {form?.id && <ContentItemEditor key={form.id} item={form} save={(patch, base) => autosaveContent(form.id, patch, base)} onDone={() => setForm(null)} />}
    {form && !form.id && <section className="staff-dashboard-section" aria-labelledby="content-edit-heading"><h2 id="content-edit-heading">Add item</h2><form className="staff-form" onSubmit={(event) => { event.preventDefault(); save("content/save", { item: form }, "Content saved."); }}>
      <label>Section<select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}>{sections.map((section) => <option key={section}>{section}</option>)}</select></label>
      <label>Order<input type="number" min="1" max="10000" required value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} /></label>
      <label>Title<input required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <label>Short text<textarea required maxLength={12000} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} /></label>
      <label>Primary link<input type="url" placeholder="https://" value={form.link || ""} onChange={(e) => setForm({ ...form, link: e.target.value })} /></label>
      <label className="checkbox-label"><input type="checkbox" checked={form.active === true} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Active</label>
      <div className="button-row"><button className="primary" disabled={busy}>Save</button><button type="button" onClick={() => setForm(null)}>Cancel</button></div>
    </form></section>}
    <section className="staff-dashboard-section"><h2>Staff list</h2><p>Active names are used to attribute staff updates and handovers.</p><button type="button" onClick={() => setStaffForm({ name: "", role: "tutor", program: "", email: "", phone: "", telegram: "", active: true })}>Add staff member</button>{data.staff.map((person) => <p key={person.id}>{person.name} · {person.role}{person.program ? ` · ${person.program}` : ""} <button type="button" onClick={() => setStaffForm({ id: person.id, name: person.name, role: person.role, program: person.program, email: person.email, phone: person.phone, telegram: person.telegram, active: person.isActive })}>Edit</button></p>)}</section>
    {staffForm && <form className="staff-form" onSubmit={(event) => { event.preventDefault(); save("staff/save", { staff: staffForm }, "Staff list saved."); }}><label>Name<input required value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} /></label><label>Role<select value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}><option value="tutor">Tutor</option><option value="admin">Admin</option></select></label><label>Program<input value={staffForm.program} onChange={(e) => setStaffForm({ ...staffForm, program: e.target.value })} /></label><label>Email<input type="email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} /></label><label>Phone<input value={staffForm.phone} onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })} /></label><label>Telegram<input value={staffForm.telegram} onChange={(e) => setStaffForm({ ...staffForm, telegram: e.target.value })} /></label><label className="checkbox-label"><input type="checkbox" checked={staffForm.active} onChange={(e) => setStaffForm({ ...staffForm, active: e.target.checked })} />Active</label><button className="primary" disabled={busy}>Save staff member</button></form>}
  </div>;
}

function statusDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(date);
}

export function BackupPage() {
  const { session } = useOutletContext();
  const [status, setStatus] = useState(null), [message, setMessage] = useState(""), [error, setError] = useState("");
  useEffect(() => { staffRequest("workbook/status").then(setStatus).catch((e) => setError(e.message)); }, []);
  async function backup() {
    setError(""); setMessage("");
    try { const result = await staffRequest("workbook/backup", { csrf: session.csrf, body: {} }); setMessage(`Backup created · ${statusDate(result.createdAt)}`); setStatus(await staffRequest("workbook/status")); }
    catch (e) { setError(e.message); }
  }
  return <section className="staff-page"><p className="staff-eyebrow">COORDINATOR · DATA SAFETY</p><h1>Backup</h1><p>Last backup: {statusDate(status?.lastBackup)}</p><button className="primary" onClick={backup}>Create backup now</button> <a href="/api/staff/workbook/download">Download Welcome-Lounge.xlsx</a>{message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}</section>;
}
