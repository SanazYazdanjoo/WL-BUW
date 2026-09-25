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
  return <section className="staff-panel staff-content-editor" aria-labelledby="content-edit-heading">
    <h2 id="content-edit-heading">Edit item</h2>
    <div className="staff-form">
      <div className="staff-autosave-position"><SaveStatus {...autosave} onRetry={autosave.retry} onUseMine={() => autosave.resolveConflict(true)} onUseLatest={() => autosave.resolveConflict(false)} /></div>
      <label>Section<select value={item.section} disabled>{sections.map((section) => <option key={section}>{section}</option>)}</select></label>
      <label>Order<input type="number" min="1" max="10000" required value={autosave.draft.order} onChange={(e) => set("order", Number(e.target.value))} /></label>
      <label>Title<input autoFocus required maxLength={200} value={autosave.draft.title} onChange={(e) => set("title", e.target.value)} /></label>
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
  const [selectedSection, setSelectedSection] = useState("First Step");
  const [logins, setLogins] = useState({});
  const loadLogins = useCallback(() => staffRequest("accounts").then((result) => setLogins(Object.fromEntries(result.accounts.map((account) => [account.staffId, account.username])))).catch(() => setLogins({})), []);
  useEffect(() => { loadLogins(); }, [loadLogins]);
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
  function addItem(section) {
    const order = Math.max(0, ...items.filter((item) => item.section === section).map((item) => item.order)) + 1;
    setForm({ ...emptyItem(), section, order });
  }
  async function resetLogin(person) {
    if (!window.confirm(`Reset ${person.name}'s personal login? They will sign in with the shared login again.`)) return;
    await save("account/reset", { staffId: person.id }, `${person.name} uses the shared login again.`);
    await loadLogins();
  }
  async function removeItem(item) {
    if (!window.confirm(`Remove “${item.title}” from the workbook?${item.section === "First Step" && item.active ? " Its Journey node and connecting lines will disappear from the student app." : ""}`)) return;
    await save("content/delete", { id: item.id }, `Removed ${item.title}.`);
  }
  if (error && !status) return <div className="staff-page"><h1>Content</h1><p role="alert">{error}</p><button onClick={reload}>Retry</button></div>;
  if (!status) return <p role="status">Loading content…</p>;
  if (!data) return <div className="staff-page">
    <header className="staff-page-heading"><h1>Content</h1></header>
    {status.workbook === "missing" ? <section className="staff-panel">
      <h2>Connect your workbook</h2>
      <p>Upload <strong>Welcome-Lounge.xlsx</strong> to the configured Nextcloud app folder, then refresh.</p>
      <details className="staff-disclosure"><summary>Workbook requirements</summary><p>Use the operational workbook at the root of the app folder. The public content workbook, <strong>content-source/Welcome-Lounge-Content.xlsx</strong>, is a separate file.</p></details>
    </section> : <p>{status.workbook === "not-configured" ? "Unified workbook detection is disabled for this deployment." : status.workbook === "invalid" ? (status.error || "Welcome-Lounge.xlsx could not be read. Check the workbook and Nextcloud access.") : "Welcome-Lounge.xlsx is unavailable. Check the configured Nextcloud app folder and access."}</p>}
    {error && <p role="alert">{error}</p>}<button type="button" onClick={reload}>Refresh</button>
  </div>;
  const items = data.items;
  const sectionItems = items.filter((item) => item.section === selectedSection).sort((a, b) => a.order - b.order);
  return <div className="staff-page staff-content-page">
    <header className="staff-page-heading"><h1>Content</h1></header>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    {data.warnings?.length > 0 && <aside className="content-history" aria-label="Review required">{data.warnings.map((warning) => <p key={warning}>{warning}</p>)}</aside>}
    {!status.connected && <p role="alert">Nextcloud connection problem. Check your workbook connection before editing.</p>}
    <section className="staff-panel" aria-labelledby="student-content-heading">
      <div className="staff-toolbar"><h2 id="student-content-heading">Student content</h2><button type="button" className="primary" disabled={Boolean(form)} onClick={() => addItem(selectedSection)}>Add item</button></div>
      <div className="staff-section-switcher" role="group" aria-label="Content sections">
        {sections.map((section) => <button key={section} type="button" aria-pressed={selectedSection === section} disabled={Boolean(form) && selectedSection !== section} onClick={() => setSelectedSection(section)}>{section === "First Step" ? "Journey" : section}<span className="staff-count">{items.filter((item) => item.section === section).length}</span></button>)}
      </div>
    {form?.id && <ContentItemEditor key={form.id} item={form} save={(patch, base) => autosaveContent(form.id, patch, base)} onDone={() => setForm(null)} />}
    {form && !form.id && <section className="staff-panel staff-content-editor" aria-labelledby="content-edit-heading"><h2 id="content-edit-heading">Add item</h2><form className="staff-form" onSubmit={(event) => { event.preventDefault(); save("content/save", { item: form }, "Content saved."); }}>
      <label>Section<select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}>{sections.map((section) => <option key={section}>{section}</option>)}</select></label>
      <label>Order<input type="number" min="1" max="10000" required value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} /></label>
      <label>Title<input autoFocus required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <label>Short text<textarea required maxLength={12000} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} /></label>
      <label>Primary link<input type="url" placeholder="https://" value={form.link || ""} onChange={(e) => setForm({ ...form, link: e.target.value })} /></label>
      <label className="checkbox-label"><input type="checkbox" checked={form.active === true} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Active</label>
      <div className="button-row"><button className="primary" disabled={busy}>Save</button><button type="button" onClick={() => setForm(null)}>Cancel</button></div>
    </form></section>}
      {sectionItems.length === 0 && <p className="staff-muted">No items yet.</p>}
      {sectionItems.map((item) => <details className="staff-content-item" key={item.id}>
        <summary><span className="staff-content-item-heading"><strong>{item.order}. {item.title}</strong><span className={`staff-content-state${item.active ? "" : " is-inactive"}`}>{item.active ? "Active" : "Inactive"}</span></span></summary>
        <div className="staff-content-item-body">
          <p>{item.text}</p>{item.link && <a href={item.link} target="_blank" rel="noreferrer">Open link</a>}
          <div className="button-row">
            <button type="button" disabled={Boolean(form) || busy} onClick={() => setForm({ ...item })}>Edit</button>
            <button type="button" disabled={busy || Boolean(form)} onClick={() => save("content/save", { item: { ...item, active: !item.active } }, item.active ? "Item deactivated." : "Item activated.")}>{item.active ? "Deactivate" : "Activate"}</button>
            <button type="button" className="content-delete-button" disabled={busy || Boolean(form)} onClick={() => removeItem(item)}>Remove</button>
          </div>
        </div>
      </details>)}
      {selectedSection === "First Step" && <details className="staff-disclosure"><summary>How Journey works</summary><p>Active steps appear on the student map in workbook order. Changes to existing items save automatically and appear on the next student site request.</p></details>}
    </section>
    <div className="staff-settings-grid">
      <details className="staff-panel staff-disclosure">
        <summary>Semester and support</summary>
        {settingsForm && <form className="staff-form" onSubmit={(event) => { event.preventDefault(); save("settings/save", settingsForm, "Settings saved."); }}>
          <label>Semester<input required maxLength={100} value={settingsForm.semesterLabel || ""} onChange={(e) => setSettingsForm({ ...settingsForm, semesterLabel: e.target.value })} /></label>
          <label>WhatsApp group<input type="url" placeholder="https://chat.whatsapp.com/..." value={settingsForm.whatsappGroupUrl || ""} onChange={(e) => setSettingsForm({ ...settingsForm, whatsappGroupUrl: e.target.value })} /></label>
          <label className="checkbox-label"><input type="checkbox" checked={settingsForm.whatsappEnabled === true} onChange={(e) => setSettingsForm({ ...settingsForm, whatsappEnabled: e.target.checked })} />Enable WhatsApp</label>
          <label>Last reviewed<input type="date" value={settingsForm.contentReviewedDate || ""} onChange={(e) => setSettingsForm({ ...settingsForm, contentReviewedDate: e.target.value })} /></label>
          <button className="primary" disabled={busy || Boolean(form)}>Save settings</button>
        </form>}
      </details>
      <details className="staff-panel staff-disclosure">
        <summary>Staff <span className="staff-count">{data.staff.length}</span></summary>
        <div className="staff-toolbar"><button type="button" disabled={Boolean(staffForm)} onClick={() => setStaffForm({ name: "", role: "tutor", program: "", email: "", phone: "", telegram: "", active: true })}>Add staff member</button></div>
        {staffForm && <form className="staff-form" onSubmit={(event) => { event.preventDefault(); save("staff/save", { staff: staffForm }, "Staff list saved."); }}>
          <label>Name<input autoFocus required value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} /></label>
          <label>Role<select value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}><option value="tutor">Tutor</option><option value="admin">Admin</option></select></label>
          <label>Program<input value={staffForm.program || ""} onChange={(e) => setStaffForm({ ...staffForm, program: e.target.value })} /></label>
          <label>Email<input type="email" value={staffForm.email || ""} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} /></label>
          <label>Phone<input value={staffForm.phone || ""} onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })} /></label>
          <label>Telegram<input value={staffForm.telegram || ""} onChange={(e) => setStaffForm({ ...staffForm, telegram: e.target.value })} /></label>
          <label className="checkbox-label"><input type="checkbox" checked={staffForm.active} onChange={(e) => setStaffForm({ ...staffForm, active: e.target.checked })} />Active</label>
          <div className="button-row"><button className="primary" disabled={busy || Boolean(form)}>Save staff member</button><button type="button" onClick={() => setStaffForm(null)}>Cancel</button></div>
        </form>}
        <ul className="staff-staff-list">{data.staff.map((person) => <li className="staff-staff-row" key={person.id}><div><strong>{person.name}</strong><p className="staff-muted">{person.role}{person.program ? ` · ${person.program}` : ""}{!person.isActive ? " · Inactive" : ""} · {logins[person.id] ? `personal login “${logins[person.id]}”` : "shared login"}</p></div>{logins[person.id] && <button type="button" disabled={busy} onClick={() => resetLogin(person)}>Reset login</button>}<button type="button" disabled={Boolean(staffForm)} aria-label={`Edit ${person.name}`} onClick={() => setStaffForm({ id: person.id, name: person.name, role: person.role, program: person.program, email: person.email, phone: person.phone, telegram: person.telegram, active: person.isActive })}>Edit</button></li>)}</ul>
      </details>
      <details className="staff-panel staff-disclosure">
        <summary>Workbook</summary>
        <p>{data.sourceFilename}</p>
        <dl className="staff-workbook-details"><div><dt>Updated</dt><dd>{statusDate(status.lastModified)}</dd></div><div><dt>Nextcloud</dt><dd>{status.connected ? "Connected" : "Connection problem"}</dd></div><div><dt>Workbook</dt><dd>{status.workbook}</dd></div><div><dt>Last backup</dt><dd>{statusDate(data.lastBackup)}</dd></div></dl>
        {data.idAssignments?.length > 0 && <p className="staff-muted">{data.idAssignments.length} new content ID{data.idAssignments.length === 1 ? "" : "s"} will be saved with the next workbook update.</p>}
        <div className="button-row"><a href="/api/staff/workbook/download">Download workbook</a><button type="button" disabled={busy || Boolean(form)} onClick={() => save("workbook/backup", {}, "Backup created.")}>Create backup</button></div>
      </details>
    </div>
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

const emptyEvent = () => ({ title: "", date: "", startTime: "", endTime: "", location: "", description: "", link: "", active: true });
function eventProblem(draft) {
  if (!draft.title.trim()) return "Enter an event title.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return "Choose the event date.";
  if (draft.endTime && (!draft.startTime || draft.endTime < draft.startTime)) return "The end time must be after the start time.";
  if (draft.link && !/^https:\/\/[^\s]+$/i.test(draft.link)) return "Enter a complete HTTPS link.";
  return "";
}
const eventWhen = (event) => [new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${event.date}T00:00:00Z`)), event.startTime && (event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime)].filter(Boolean).join(" · ");

function EventFields({ value, set }) {
  return <>
    <label>Title<input autoFocus required maxLength={200} value={value.title} onChange={(e) => set("title", e.target.value)} /></label>
    <label>Date<input type="date" required value={value.date} onChange={(e) => set("date", e.target.value)} /></label>
    <label>Start<input type="time" value={value.startTime} onChange={(e) => set("startTime", e.target.value)} /></label>
    <label>End<input type="time" value={value.endTime} onChange={(e) => set("endTime", e.target.value)} /></label>
    <label>Location<input maxLength={300} value={value.location} onChange={(e) => set("location", e.target.value)} /></label>
    <label>Description<textarea maxLength={12000} value={value.description} onChange={(e) => set("description", e.target.value)} /></label>
    <label>Link<input type="url" placeholder="https://" value={value.link} onChange={(e) => set("link", e.target.value)} /></label>
  </>;
}

function EventItemEditor({ event, save, onDone }) {
  const autosave = useAutosave({ title: event.title, date: event.date, startTime: event.startTime, endTime: event.endTime, location: event.location, description: event.description, link: event.link, active: event.active }, save, { validate: eventProblem });
  const set = (field, value, delay) => autosave.setField(field, value, delay);
  return <section className="staff-panel staff-content-editor" aria-labelledby="event-edit-heading">
    <h2 id="event-edit-heading">Edit event</h2>
    <div className="staff-form">
      <div className="staff-autosave-position"><SaveStatus {...autosave} onRetry={autosave.retry} onUseMine={() => autosave.resolveConflict(true)} onUseLatest={() => autosave.resolveConflict(false)} /></div>
      <EventFields value={autosave.draft} set={set} />
      <label className="checkbox-label"><input type="checkbox" checked={autosave.draft.active} onChange={(e) => set("active", e.target.checked, AUTOSAVE_TOGGLE_DELAY)} />Active</label>
      <button type="button" disabled={autosave.hasUnsavedChanges || autosave.status === "saving" || autosave.status === "error" || autosave.status === "conflict"} onClick={onDone}>Close editor</button>
    </div>
  </section>;
}

export function EventsManagementPage() {
  const { session } = useOutletContext();
  const [data, setData] = useState(null), [form, setForm] = useState(null), [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    try { setData(await staffRequest("events")); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => {
    let active = true;
    staffRequest("events").then((result) => { if (active) setData(result); }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  async function save(action, body, savedMessage) {
    setBusy(true); setError(""); setMessage("");
    try {
      await staffRequest(action, { csrf: session.csrf, body: { ...body, etag: data?.etag } });
      setMessage(savedMessage);
      setForm(null);
      await reload();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function autosaveEvent(id, patch, base) {
    const result = await staffRequest("events/autosave", { csrf: session.csrf, body: { id, patch, base, etag: data?.etag } });
    await reload();
    return result;
  }
  async function removeEvent(event) {
    if (!window.confirm(`Remove the event “${event.title}” from the workbook?`)) return;
    await save("events/delete", { id: event.id }, `Removed ${event.title}.`);
  }
  if (!data) return <div className="staff-page"><h1>Events</h1>{error ? <><p role="alert">{error}</p><button type="button" onClick={reload}>Retry</button></> : <p role="status">Loading events…</p>}</div>;
  const events = [...data.events].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  return <div className="staff-page staff-content-page">
    <header className="staff-page-heading"><h1>Events</h1><button type="button" className="primary" disabled={Boolean(form)} onClick={() => setForm(emptyEvent())}>Add event</button></header>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    {form?.id && <EventItemEditor key={form.id} event={form} save={(patch, base) => autosaveEvent(form.id, patch, base)} onDone={() => setForm(null)} />}
    {form && !form.id && <section className="staff-panel staff-content-editor" aria-labelledby="event-add-heading"><h2 id="event-add-heading">Add event</h2><form className="staff-form" onSubmit={(event) => { event.preventDefault(); const problem = eventProblem(form); if (problem) { setError(problem); return; } save("events/save", { event: form }, "Event saved."); }}>
      <EventFields value={form} set={(field, value) => setForm({ ...form, [field]: value })} />
      <label className="checkbox-label"><input type="checkbox" checked={form.active === true} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Active</label>
      <div className="button-row"><button className="primary" disabled={busy}>Save</button><button type="button" onClick={() => setForm(null)}>Cancel</button></div>
    </form></section>}
    <section className="staff-panel" aria-label="Event list">
      {events.length === 0 && <p className="staff-muted">No events yet.</p>}
      {events.map((event) => <details className="staff-content-item" key={event.id}>
        <summary><span className="staff-content-item-heading"><strong>{event.title}</strong><span className={`staff-content-state${event.active ? "" : " is-inactive"}`}>{event.active ? "Active" : "Inactive"}</span></span><span className="staff-muted">{eventWhen(event)}</span></summary>
        <div className="staff-content-item-body">
          {event.location && <p>{event.location}</p>}{event.description && <p>{event.description}</p>}{event.link && <a href={event.link} target="_blank" rel="noreferrer">Open link</a>}
          <div className="button-row">
            <button type="button" disabled={Boolean(form) || busy} onClick={() => setForm({ ...event })}>Edit</button>
            <button type="button" disabled={Boolean(form) || busy} onClick={() => save("events/save", { event: { ...event, active: !event.active } }, event.active ? "Event deactivated." : "Event activated.")}>{event.active ? "Deactivate" : "Activate"}</button>
            <button type="button" className="content-delete-button" disabled={Boolean(form) || busy} onClick={() => removeEvent(event)}>Remove</button>
          </div>
        </div>
      </details>)}
      <details className="staff-disclosure"><summary>How Events work</summary><p>Active events from today onwards appear on the student Events page, sorted by date. They are stored in the Events tab of Welcome-Lounge.xlsx, so they can also be edited there.</p></details>
    </section>
  </div>;
}
