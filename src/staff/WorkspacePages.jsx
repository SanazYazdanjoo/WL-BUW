import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useOutletContext, useSearchParams } from "react-router-dom";
import { useWorkspace } from "./useWorkspace";
import { staffRequest } from "./service";
import { PasswordInput } from "./PasswordInput";
import { canManage, canManageLogins, roleLabel } from "./roles";
import { AUTOSAVE_TOGGLE_DELAY, useAutosave } from "./useAutosave";
import { SaveStatus } from "./SaveStatus";
import { COUNTRY_OPTIONS, STUDY_PROGRAM_OPTIONS } from "./studentOptions";
import { fairShare, formatHours, shiftHours, tutorStatistics } from "./statistics";
const studyProgramOptions = (workspace) => [...new Set([...STUDY_PROGRAM_OPTIONS, ...(workspace?.data?.students || []).map((student) => student.studyProgram).filter(Boolean), ...(workspace?.data?.programTutors || []).map((tutor) => tutor.program).filter(Boolean)])].sort((a, b) => a.localeCompare(b));
function SuggestedInput({ label, name, value, onChange, options, maxLength = 300, type = "text" }) {
  const listId = `student-${name}-options`;
  return <label>{label}<input type={type} list={listId} maxLength={maxLength} value={value || ""} onChange={(event) => onChange(event.target.value)} /><datalist id={listId}>{options.map((option) => <option key={option} value={option} />)}</datalist></label>;
}
function State({ error }) {
  return error ? (
    <p role="alert">{error}</p>
  ) : (
    <p role="status">Loading staff records…</p>
  );
}
// Excel export of the students added on a chosen day; built on the server.
function StudentExport({ workspace }) {
  const [date, setDate] = useState(workspace.today);
  const count = workspace.data.students.filter((student) => student.legacyDate === date).length;
  return (
    <details className="staff-disclosure staff-student-export">
      <summary>Export students for a day</summary>
      <div className="staff-form staff-form-grid">
        <label>Students added on<input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <p className="staff-muted staff-field-wide">{count} student{count === 1 ? "" : "s"} · Excel file with all student details.</p>
        {date ? <a className="staff-export-link" href={`/api/staff/students/export?date=${encodeURIComponent(date)}`} download>Download Excel</a> : <p className="staff-muted">Choose a day.</p>}
      </div>
    </details>
  );
}
// Every student field is edited right in the table. Checkboxes save almost
// immediately, text after a short pause; the server logs who changed what.
// One line per student. Address is optional ("Show address"); checkboxes save
// almost immediately, text after a short pause; the server logs who changed what.
const STUDENT_COLUMNS = [
  { field: "name", label: "Full name", max: 200, share: 12 },
  { field: "matriculationNumber", label: "Matriculation no.", short: "Matric. no.", max: 100, share: 8 },
  { field: "country", label: "Country", max: 200, list: "staff-country-options", share: 8 },
  { field: "studyProgram", label: "Study program", short: "Program", max: 300, list: "staff-program-options", share: 11 },
  { field: "address", label: "Address", max: 12000, optional: true, share: 11 },
  { field: "enrolled", label: "Enrolled", check: true, share: 7 },
  { field: "accommodation", label: "Accommodation", short: "Accomm.", check: true, share: 8 },
  { field: "accommodationContact", label: "Contact (if no accommodation)", short: "Contact", max: 1000, contact: true, share: 10 },
  { field: "cityRegistration", label: "City registration appointment", short: "City reg.", check: true, share: 7 },
  { field: "notes", label: "Note", max: 4000, share: 9 },
];
// "Date added" is set by the server when a student is created and is read-only here.
const DATE_ADDED_SHARE = 8;
const formatDay = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)) : "—");
const visibleStudentColumns = (showAddress) => STUDENT_COLUMNS.filter((column) => !column.optional || showAddress);
const studentRowDraft = (student) => ({
  ...Object.fromEntries(STUDENT_COLUMNS.filter((column) => !column.check).map(({ field }) => [field, String(student[field] ?? "")])),
  // Keep stored values (null = unknown) so the server sees the right base on first change.
  ...Object.fromEntries(STUDENT_COLUMNS.filter((column) => column.check).map(({ field }) => [field, student[field] ?? null])),
});
const studentRowProblem = (draft) => (!draft.name.trim() ? "Enter the student's full name." : "");

function StudentCells({ columns, draft, set, who, nameRef }) {
  return columns.map(({ field, label, max, list, type, check, contact }) => check
    ? <td key={field} data-label={label} className="staff-cell-check"><input type="checkbox" aria-label={`${label} · ${who}`} checked={draft[field] === true} onChange={(e) => set(field, e.target.checked, AUTOSAVE_TOGGLE_DELAY)} /></td>
    : <td key={field} data-label={label}>
      <input
        ref={field === "name" ? nameRef : undefined}
        className="staff-cell-input"
        aria-label={`${label} · ${who}`}
        placeholder={field === "name" && nameRef ? "+ New student" : contact && draft.accommodation !== true ? "Phone, email or address" : ""}
        disabled={contact && draft.accommodation === true}
        list={list}
        type={type || "text"}
        maxLength={max}
        title={draft[field] || undefined}
        value={draft[field]}
        onChange={(e) => set(field, e.target.value)}
      />
    </td>);
}

function StudentRow({ student, save, columns }) {
  const autosave = useAutosave(studentRowDraft(student), save, { validate: studentRowProblem });
  return (
    <tr>
      <StudentCells columns={columns} draft={autosave.draft} set={autosave.setField} who={autosave.draft.name || "student"} />
      <td data-label="Date added" className="staff-cell-date">{formatDay(student.legacyDate)}</td>
      <td className="staff-cell-status"><SaveStatus {...autosave} onRetry={autosave.retry} onUseMine={() => autosave.resolveConflict(true)} onUseLatest={() => autosave.resolveConflict(false)} /></td>
    </tr>
  );
}

// Like the empty row under an Excel table: fill it in, then press Enter or
// leave the row to add the student. A fresh empty row appears straight away.
function NewStudentRow({ onCreate, columns, today }) {
  const blank = () => ({ ...studentRowDraft({}), enrolled: false, accommodation: false, cityRegistration: false });
  const [draft, setDraft] = useState(blank);
  const [state, setState] = useState({ saving: false, error: "" });
  const nameRef = useRef(null);
  const savingRef = useRef(false);
  const set = (field, value) => { setDraft((current) => ({ ...current, [field]: value })); setState((current) => ({ ...current, error: "" })); };
  const touched = Object.entries(draft).some(([, value]) => value === true || (typeof value === "string" && value.trim()));
  async function create() {
    if (savingRef.current || !touched) return;
    const problem = studentRowProblem(draft);
    if (problem) { setState({ saving: false, error: problem }); return; }
    savingRef.current = true;
    setState({ saving: true, error: "" });
    const result = await onCreate(Object.fromEntries(Object.entries(draft).map(([field, value]) => [field, typeof value === "string" ? value.trim() : value])));
    savingRef.current = false;
    if (result.ok) { setDraft(blank()); setState({ saving: false, error: "" }); nameRef.current?.focus(); }
    else setState({ saving: false, error: result.error || "The student could not be added." });
  }
  return (
    <tr
      className="staff-new-student-row"
      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); create(); } if (event.key === "Escape") { setDraft(blank()); setState({ saving: false, error: "" }); } }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) create(); }}
    >
      <StudentCells columns={columns} draft={draft} set={set} who="new student" nameRef={nameRef} />
      <td data-label="Date added" className="staff-cell-date is-pending">{formatDay(today)}</td>
      <td className="staff-cell-status">
        <div className="staff-autosave" aria-live="polite">
          {state.saving ? <span>Adding…</span> : state.error ? <span className="staff-autosave-error" role="alert">{state.error}</span> : touched ? <span>Press Enter to add</span> : null}
        </div>
      </td>
    </tr>
  );
}

function StudentTable({ students, save, programOptions, onCreate, showAddress, today }) {
  const columns = visibleStudentColumns(showAddress);
  if (!students.length && !onCreate) return <p className="staff-empty-state">No students found.</p>;
  return (
    <div className="table-scroll">
      <datalist id="staff-country-options">{COUNTRY_OPTIONS.map((option) => <option key={option} value={option} />)}</datalist>
      <datalist id="staff-program-options">{programOptions.map((option) => <option key={option} value={option} />)}</datalist>
      <table aria-label="Student records" className="staff-student-table">
        <thead>
          <tr>
            {/* Column widths are proportional shares, so a row always fits on one line. */}
            {columns.map(({ field, label, short, check, share }) => <th key={field} title={short ? label : undefined} className={check ? "staff-col-check" : undefined} style={{ width: `${(share / (columns.reduce((sum, column) => sum + column.share, 0) + DATE_ADDED_SHARE)) * 94}%` }}>{short ? <><span aria-hidden="true">{short}</span><span className="sr-only">{label}</span></> : label}</th>)}
            <th style={{ width: `${(DATE_ADDED_SHARE / (columns.reduce((sum, column) => sum + column.share, 0) + DATE_ADDED_SHARE)) * 94}%` }}>Date added</th>
            <th className="staff-col-status"><span className="sr-only">Save status</span></th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => <StudentRow key={s.id} student={s} columns={columns} save={(patch, base) => save(s.id, patch, base)} />)}
          {onCreate && <NewStudentRow key={showAddress ? "with-address" : "without-address"} onCreate={onCreate} columns={columns} today={today} />}
        </tbody>
      </table>
    </div>
  );
}

function staffDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Berlin",
      }).format(date);
}

function HandoverEntries({ entries, today, limit }) {
  const previous = new Date(`${today}T12:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const previousDay = previous.toISOString().slice(0, 10);
  const recent = entries
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
  const groups = [
    { label: "Today", notes: recent.filter((note) => note.date === today) },
    { label: "Previous day", notes: recent.filter((note) => note.date === previousDay) },
    { label: "Earlier", notes: recent.filter((note) => note.date < previousDay) },
  ];
  return groups.some((group) => group.notes.length) ? groups.map((group) =>
    group.notes.length > 0 && (
      <section className="staff-handover-group" key={group.label}>
        <h3>{group.label}</h3>
        {group.notes.map((note) => (
          <article className="staff-handover-entry" key={note.id}>
            <p>{note.note}</p>
            <small>{note.author} · {staffDateTime(note.timestamp)}</small>
          </article>
        ))}
      </section>
    ),
  ) : <p>No handover notes yet.</p>;
}

function AttentionList({ students }) {
  return students.length ? (
    <ul className="staff-dash-list">
      {students.map((student) => (
        <li key={student.id}>
          <Link to={`/staff/students?q=${encodeURIComponent(student.name)}`}>{student.name || "Name not supplied"}</Link>
          <span className="staff-muted">{student.studyProgram || "No programme"}</span>
          <span className={`staff-pill ${student.enrolled === false ? "is-warning" : "is-neutral"}`}>{student.enrolled === false ? "Not enrolled" : "Enrollment unknown"}</span>
        </li>
      ))}
    </ul>
  ) : <p className="staff-empty-state">No follow-up needed.</p>;
}

function UpcomingEvents({ today }) {
  const [events, setEvents] = useState(null);
  useEffect(() => {
    let active = true;
    staffRequest("events").then((result) => { if (active) setEvents(result.events || []); }).catch(() => { if (active) setEvents([]); });
    return () => { active = false; };
  }, []);
  if (!events) return <p className="staff-muted">Loading…</p>;
  const upcoming = events.filter((event) => event.active && event.date >= today).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)).slice(0, 4);
  return upcoming.length ? (
    <ul className="staff-dash-events">
      {upcoming.map((event) => (
        <li key={event.id}>
          <span className="staff-dash-date"><strong>{new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "UTC" }).format(new Date(`${event.date}T00:00:00Z`))}</strong>{new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${event.date}T00:00:00Z`))}</span>
          <span><strong>{event.title}</strong><span className="staff-muted">{[event.startTime && (event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime), event.location].filter(Boolean).join(" · ") || "Details to follow"}</span></span>
        </li>
      ))}
    </ul>
  ) : <p className="staff-empty-state">No upcoming events.</p>;
}

function SummaryCard({ label, value, to, hint }) {
  return (
    <Link className="staff-kpi" to={to}>
      <span className="staff-kpi-label">{label}</span>
      <strong className="staff-kpi-value">{value}</strong>
      {hint && <span className="staff-kpi-hint">{hint}</span>}
    </Link>
  );
}

export function Dashboard() {
  const { session } = useOutletContext();
  const { workspace, error } = useWorkspace();
  if (!workspace) return <State error={error} />;
  const { data, today } = workspace;
  const todayShift = data.shifts.find((s) => s.date === today);
  const attentionStudents = data.students.filter(STUDENT_FILTERS.attention.test);
  const withoutHousing = data.students.filter(STUDENT_FILTERS.housing.test);
  const addedToday = data.students.filter((student) => STUDENT_FILTERS.today.test(student, today));
  const dayLabel = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "Europe/Berlin" }).format(new Date(`${today}T12:00:00Z`));
  const setupItems = [
    !data.semesterLabel && { title: "Set the semester", to: canManage(session) ? "/staff/content" : null },
    data.shifts.length === 0 && canManage(session) && { title: "Add shifts", to: "/staff/shifts" },
  ].filter(Boolean);
  const percent = (count) => (data.students.length ? `${Math.round((count / data.students.length) * 100)}% of all students` : "");
  return (
    <div className="staff-page staff-dashboard">
      <header className="staff-page-heading staff-dash-header">
        <div><h1>Today</h1><p className="staff-page-meta">{dayLabel}</p></div>
        <nav className="staff-dash-actions" aria-label="Quick actions">
          <Link className="staff-button-link is-primary" to="/staff/students">+ Add student</Link>
          <Link className="staff-button-link" to="/staff/handover">Add handover</Link>
        </nav>
      </header>
      {setupItems.length > 0 && <aside className="staff-setup-inline" aria-label="Workspace setup">
        <strong>Setup</strong>
        {setupItems.map((item) => item.to
          ? <Link key={item.title} to={item.to}>{item.title} <span aria-hidden="true">→</span></Link>
          : <span key={item.title}>Semester not set · Contact the Super Admin</span>)}
      </aside>}
      <section className="staff-kpis" aria-label="Summary">
        <SummaryCard label="Students" value={data.students.length} to="/staff/students" hint={data.semesterLabel} />
        <SummaryCard label="Needs attention" value={attentionStudents.length} to="/staff/students?filter=attention" hint={percent(attentionStudents.length) || "Enrollment not confirmed"} />
        <SummaryCard label="Without accommodation" value={withoutHousing.length} to="/staff/students?filter=housing" hint={percent(withoutHousing.length)} />
        <SummaryCard label="Added today" value={addedToday.length} to="/staff/students?filter=today" hint="New students registered today" />
      </section>
      <div className="staff-dash-grid">
        <div className="staff-dash-main">
          <section className="staff-card" aria-labelledby="attention-heading">
            <div className="staff-section-header"><h2 id="attention-heading">Needs attention <span className="staff-count">{attentionStudents.length}</span></h2>{attentionStudents.length > 0 && <Link to="/staff/students?filter=attention">View all</Link>}</div>
            <AttentionList students={attentionStudents.slice(0, 6)} />
          </section>
          <section className="staff-card" aria-labelledby="handover-heading">
            <div className="staff-section-header"><h2 id="handover-heading">Latest handover</h2>{data.handover.length > 0 ? <Link to="/staff/handover">View all</Link> : <Link to="/staff/handover">Add note</Link>}</div>
            <HandoverEntries entries={data.handover} today={today} limit={3} />
          </section>
        </div>
        <div className="staff-dash-side">
          <TodayShifts day={todayShift} times={workspace.shiftTimes || DEFAULT_SHIFT_TIMES} />
          <section className="staff-card" aria-labelledby="events-heading">
            <div className="staff-section-header"><h2 id="events-heading">Upcoming events</h2><Link to="/staff/events">All events</Link></div>
            <UpcomingEvents today={today} />
          </section>
        </div>
      </div>
    </div>
  );
}

// Student list filters, shared with the summary cards on the Today page.
const STUDENT_FILTERS = {
  attention: { label: "Needs attention", test: (student) => student.enrolled !== true },
  housing: { label: "Without accommodation", test: (student) => student.accommodation !== true },
  today: { label: "Added today", test: (student, today) => student.legacyDate === today },
};

export function Students() {
  const { session } = useOutletContext();
  const { workspace, error, autosave, reload } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [showAddress, setShowAddress] = useState(() => { try { return localStorage.getItem("wl-staff-show-address") === "1"; } catch { return false; } });
  const toggleAddress = (value) => { setShowAddress(value); try { localStorage.setItem("wl-staff-show-address", value ? "1" : "0"); } catch { /* storage unavailable */ } };
  if (!workspace) return <State error={error} />;
  async function createStudent(fields) {
    try {
      await staffRequest("students/create", { csrf: session.csrf, body: { ...fields, etag: workspace.etag } });
      await reload();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  const filter = STUDENT_FILTERS[searchParams.get("filter")] ? searchParams.get("filter") : "";
  const attentionOnly = filter === "attention";
  const students = workspace.data.students.filter(
    (s) =>
      (!filter || STUDENT_FILTERS[filter].test(s, workspace.today)) && `${s.name} ${s.matriculationNumber} ${s.country} ${s.studyProgram}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  return (
    <div className="staff-page staff-students-page">
      <header className="staff-page-heading"><h1>Students <span className="staff-count">{students.length}</span></h1></header>
      <div className="staff-student-toolbar">
        <label className="staff-search">
          Search students
          <input type="search" placeholder="Name, number, country or programme" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="staff-filter"><input type="checkbox" checked={attentionOnly} onChange={(event) => {
          setSearchParams((previous) => {
            const next = new URLSearchParams(previous);
            if (event.target.checked) next.set("filter", "attention"); else next.delete("filter");
            return next;
          });
        }} />Needs attention</label>
        <label className="staff-filter"><input type="checkbox" checked={showAddress} onChange={(e) => toggleAddress(e.target.checked)} />Show address</label>
      </div>
      {filter && filter !== "attention" && <p className="staff-filter-chip">Showing: {STUDENT_FILTERS[filter].label} <button type="button" onClick={() => setSearchParams({})}>Clear</button></p>}
      <StudentTable
        students={students}
        programOptions={studyProgramOptions(workspace)}
        save={(id, patch, base) => autosave("students/update", id, patch, base)}
        onCreate={workspace.unified ? createStudent : null}
        showAddress={showAddress}
        today={workspace.today}
      />
      {workspace.unified && <StudentExport workspace={workspace} />}
    </div>
  );
}
function StudentEditor({ student, save, programOptions }) {
  const autosave = useAutosave({
    name: student.name || "",
    matriculationNumber: String(student.matriculationNumber || ""),
    enrolled: student.enrolled,
    accommodation: student.accommodation ?? null,
    accommodationContact: student.accommodationContact || "",
    cityRegistration: student.cityRegistration ?? null,
    address: student.address,
    country: student.country,
    studyProgram: student.studyProgram,
    notes: student.notes,
  }, save, { validate: (draft) => (!draft.name.trim() ? "Enter the student's full name." : "") });
  const { draft, setField } = autosave;
  return (
    <div className="staff-form staff-student-editor">
      <div className="staff-autosave-position"><SaveStatus {...autosave} onRetry={autosave.retry} onUseMine={() => autosave.resolveConflict(true)} onUseLatest={() => autosave.resolveConflict(false)} /></div>
      <fieldset className="staff-fieldset">
        <legend>Personal details</legend>
        <div className="staff-form-grid">
          <label>Full name<input required maxLength={200} value={draft.name} onChange={(e) => setField("name", e.target.value)} /></label>
          <label>Matriculation number<input maxLength={100} value={draft.matriculationNumber} onChange={(e) => setField("matriculationNumber", e.target.value)} /></label>
          <SuggestedInput label="Country" name="country" value={draft.country} options={COUNTRY_OPTIONS} onChange={(value) => setField("country", value)} maxLength={200} />
          <SuggestedInput label="Study programme" name="study-program" value={draft.studyProgram} options={programOptions} onChange={(value) => setField("studyProgram", value)} />
          <label className="staff-field-wide">Address<textarea rows={2} maxLength={12000} value={draft.address || ""} onChange={(e) => setField("address", e.target.value)} /></label>
        </div>
      </fieldset>
      <fieldset className="staff-fieldset">
        <legend>Arrival</legend>
        <div className="staff-form-grid">
          {[["enrolled", "Enrolled"]].map(([field, label]) => (
            <label key={field}>
              {label}
              <select value={String(draft[field] ?? null)} onChange={(e) => setField(field, e.target.value === "null" ? null : e.target.value === "true", AUTOSAVE_TOGGLE_DELAY)}>
                <option value="null">Unknown</option><option value="true">Yes</option><option value="false">No</option>
              </select>
            </label>
          ))}
          {[["accommodation", "Accommodation"], ["cityRegistration", "City registration appointment"]].map(([field, label]) => (
            <label className="checkbox-label" key={field}><input type="checkbox" checked={draft[field] === true} onChange={(e) => setField(field, e.target.checked, AUTOSAVE_TOGGLE_DELAY)} />{label}</label>
          ))}
          {draft.accommodation !== true && <label className="staff-field-wide">Contact (if no accommodation)<textarea rows={2} maxLength={1000} value={draft.accommodationContact} onChange={(e) => setField("accommodationContact", e.target.value)} /></label>}
        </div>
      </fieldset>
      <fieldset className="staff-fieldset staff-fieldset-wide">
        <legend>Notes</legend>
        <label><span className="sr-only">Student notes</span><textarea rows={3} maxLength={4000} value={draft.notes || ""} onChange={(e) => setField("notes", e.target.value)} /></label>
      </fieldset>
    </div>
  );
}
export function StudentDetail() {
  const { studentId } = useParams();
  const { workspace, error, autosave } = useWorkspace();
  if (!workspace) return <State error={error} />;
  const s = workspace.data.students.find((s) => s.id === studentId);
  if (!s)
    return (
      <div className="staff-page">
        <header className="staff-page-heading"><h1>Student not found</h1></header>
        <Link to="/staff/students">Back to students</Link>
      </div>
    );
  const recentUpdates = (workspace.data.audit || [])
    .filter((entry) => entry.action === "student.fields" && entry.recordId === s.id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 5);
  const fieldNames = {
    name: "Name",
    matriculationNumber: "Matriculation number",
    enrolled: "Enrollment",
    accommodation: "Accommodation",
    accommodationContact: "Contact (if no accommodation)",
    cityRegistration: "City registration appointment",
    notes: "Note / Comment",
    address: "Address",
    country: "Country",
    studyProgram: "Study programme",
  };
  return (
    <div className="staff-page staff-student-detail">
      <Link className="staff-back-link" to="/staff/students"><span aria-hidden="true">← </span>Students</Link>
      <header className="staff-page-heading staff-record-header">
        <div><h1>{s.name || "Student record"}</h1><p className="staff-page-meta">{[s.studyProgram, s.matriculationNumber ? `No. ${s.matriculationNumber}` : "No matriculation number"].filter(Boolean).join(" · ")}</p></div>
      </header>
      <p className="staff-record-meta">Date added: {s.legacyDate || "Unknown"}</p>
      {error && <p role="alert">{error}</p>}
      <StudentEditor
        key={s.id}
        student={s}
        programOptions={studyProgramOptions(workspace)}
        save={(patch, base) => autosave("students/update", s.id, patch, base)}
      />
      {recentUpdates.length > 0 && (
        <details className="staff-record-history staff-disclosure">
          <summary>Recent updates</summary>
          {recentUpdates.map((entry) => (
            <article className="staff-handover-entry" key={entry.id}>
              <p>{entry.changedFields.map((field) => fieldNames[field] || "Student details").join(" · ")}</p>
              <small>Updated by {entry.actor.name} · {staffDateTime(entry.timestamp)}</small>
            </article>
          ))}
        </details>
      )}
    </div>
  );
}
const SLOT_KEYS = [["first", 1], ["second", 2]];
const DEFAULT_SHIFT_TIMES = { first: "10:00–13:00", second: "12:00–15:00" };
const isoDay = (date) => date.toISOString().slice(0, 10);
const addDays = (iso, days) => { const date = new Date(`${iso}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return isoDay(date); };
const weekday = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const dayLabel = (iso) => `${iso} (${new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`))})`;
const shiftDraft = (day) => ({
  ...Object.fromEntries(SLOT_KEYS.flatMap(([slot, n]) => [0, 1, 2, 3].map((i) => [`s${n}p${i + 1}`, day?.[slot]?.[i] || ""]))),
  note: day?.event || "",
});

// Top right of the Today page: who works in each shift today (or why the lounge is closed).
function TodayShifts({ day, times }) {
  const closed = day?.event && ![...day.first, ...day.second].some(Boolean);
  return (
    <aside className="staff-on-duty" aria-labelledby="on-duty-heading">
      <div className="staff-section-header"><h2 id="on-duty-heading">On duty today</h2><Link to="/staff/shifts">Shifts</Link></div>
      {!day ? <p className="staff-muted">Nobody is scheduled today.</p> : <>
        {day.event && <p className="staff-shift-note">{day.event}</p>}
        {!closed && SLOT_KEYS.map(([slot, n]) => (
          <p key={slot} className="staff-on-duty-slot">
            <span className={`staff-on-duty-label is-s${n}`}>S{n} · {times[slot]}</span>
            <strong>{day[slot].filter(Boolean).join(", ") || "Nobody assigned"}</strong>
          </p>
        ))}
      </>}
    </aside>
  );
}

// One day of the schedule; each cell autosaves and the server logs who changed what.
function ShiftDayRow({ date, day, save, me, editAll }) {
  const autosave = useAutosave(shiftDraft(day), save);
  const { draft, setField } = autosave;
  const isMe = (value) => Boolean(me) && value.trim().toLocaleLowerCase("en") === me.trim().toLocaleLowerCase("en");
  const weekend = [0, 6].includes(weekday(date));
  const people = SLOT_KEYS.flatMap(([, n]) => [1, 2, 3, 4].map((p) => `s${n}p${p}`));
  // Use saved values so the layout doesn't switch (and steal focus) while someone is typing.
  const closed = Boolean(day?.event) && ![...day.first, ...day.second].some(Boolean);
  // Tutors don't type: "+ Add me" in any empty cell, and "×" next to their own name.
  const tutorCell = (field, label) => {
    const value = draft[field];
    if (field === "note") return value ? <span className="staff-shift-text">{value}</span> : null;
    if (isMe(value)) return <span className="staff-shift-me">{value}<button type="button" aria-label={`Remove me from ${label} · ${date}`} onClick={() => setField(field, "", AUTOSAVE_TOGGLE_DELAY)}>×</button></span>;
    if (value) return <span className="staff-shift-text">{value}</span>;
    const n = field[1];
    const slotFields = [1, 2, 3, 4].map((p) => `s${n}p${p}`);
    // Hidden only where you already work that same shift that day (hours would count twice).
    const alreadyIn = slotFields.some((other) => isMe(draft[other]));
    return !alreadyIn ? <button type="button" className="staff-shift-add" aria-label={`Add me to ${label} · ${date}`} onClick={() => setField(field, me, AUTOSAVE_TOGGLE_DELAY)}>+ Add me</button> : null;
  };
  const cell = (field, label) => editAll
    ? <input className="staff-cell-input" list="staff-shift-names" aria-label={`${label} · ${date}`} maxLength={200} value={draft[field]} onChange={(e) => setField(field, e.target.value)} />
    : tutorCell(field, label);
  return (
    <tr className={closed ? "is-closed" : weekend ? "is-weekend" : undefined}>
      <th scope="row" className="staff-shift-date">{dayLabel(date)}</th>
      {closed
        ? <td colSpan={9} data-label="Note" className="staff-shift-closed">{cell("note", "Note")}</td>
        : <>
          {people.map((field) => <td key={field} data-label={`S${field[1]} · Person ${field[3]}`} className={field.startsWith("s1") ? "staff-shift-s1" : "staff-shift-s2"}>{cell(field, `S${field[1]} Person ${field[3]}`)}</td>)}
          <td data-label="Note">{cell("note", "Note")}</td>
        </>}
      <td className="staff-cell-status"><SaveStatus {...autosave} onRetry={autosave.retry} onUseMine={() => autosave.resolveConflict(true)} onUseLatest={() => autosave.resolveConflict(false)} /></td>
    </tr>
  );
}

// The Super Admin sets the semester period and shift times (also editable in the workbook's Settings tab).
function ScheduleSetup({ workspace, busy, act }) {
  const initial = () => ({ start: workspace.schedule?.start || "", end: workspace.schedule?.end || "", shift1Time: (workspace.shiftTimes || DEFAULT_SHIFT_TIMES).first, shift2Time: (workspace.shiftTimes || DEFAULT_SHIFT_TIMES).second, perShift: workspace.schedule?.perShift || 3 });
  const [form, setForm] = useState(initial);
  return (
    <details className="staff-disclosure staff-schedule-setup">
      <summary>Semester setup</summary>
      <form className="staff-form staff-form-grid" onSubmit={async (event) => { event.preventDefault(); if (!busy) await act("schedule/setup", form); }}>
        <label>First day<input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
        <label>Last day<input type="date" min={form.start || undefined} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
        <label>S1 time<input maxLength={40} placeholder="10:00–13:00" value={form.shift1Time} onChange={(e) => setForm({ ...form, shift1Time: e.target.value })} /></label>
        <label>S2 time<input maxLength={40} placeholder="12:00–15:00" value={form.shift2Time} onChange={(e) => setForm({ ...form, shift2Time: e.target.value })} /></label>
        <label>Tutors per shift<select value={form.perShift} onChange={(e) => setForm({ ...form, perShift: Number(e.target.value) })}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <div className="button-row staff-field-wide"><button className="primary" disabled={busy}>{busy ? "Saving…" : "Save semester setup"}</button><button type="button" onClick={() => setForm(initial())}>Reset</button></div>
        <p className="staff-muted staff-field-wide">Stored in the workbook's Settings tab. Tutor names are managed on the <Link to="/staff/tutor-list">Tutors</Link> page.</p>
      </form>
    </details>
  );
}

// Super Admin: who uses the shared login or a personal one; reset a password when someone forgets it.
function StaffLogins({ session }) {
  const [staff, setStaff] = useState(null), [shared, setShared] = useState(null), [editing, setEditing] = useState(null), [form, setForm] = useState({ username: "", newPassword: "" });
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const load = useCallback(() => staffRequest("accounts").then((result) => { setStaff(result.staff); setShared(result.sharedLogins || {}); }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  async function run(action, body, done) {
    setBusy(true); setError(""); setMessage("");
    try { await staffRequest(action, { csrf: session.csrf, body }); setMessage(done); setEditing(null); setForm({ username: "", newPassword: "" }); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  if (!staff) return <section className="staff-panel"><h2>Logins</h2><p role="status">{error || "Loading…"}</p></section>;
  return (
    <section className="staff-panel staff-logins" aria-labelledby="logins-heading">
      <h2 id="logins-heading">Logins</h2>
      <p className="staff-muted">Shared logins: “tutor”, “coordinator”, “admin” and “superadmin”; change their passwords here (Admins manage tutor and coordinator logins only). If someone with a personal login forgets their password, set a temporary one and tell them; they can change it on My account.</p>
      {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
      <ul className="staff-staff-list">
        {[["tutor", "Shared tutor login"], ["coordinator", "Coordinator login"], ["admin", "Admin login"], ["superadmin", "Super Admin login"]].filter(([login]) => shared?.[login]).map(([login, title]) => {
          const state = shared[login];
          return (
            <li className="staff-staff-row staff-shared-login" key={login}>
              <div>
                <strong>{title}</strong>
                <p className="staff-muted">Username “{login}” · {state.custom ? `password set here${state.updatedAt ? ` · changed ${staffDateTime(state.updatedAt)}` : ""}` : state.fromEnvironment ? "password from the server settings (Vercel)" : "no password yet — set one to enable this login"}</p>
                {editing === `shared-${login}` && (
                  <form className="staff-form staff-login-reset" onSubmit={(event) => { event.preventDefault(); run("account/shared-login", { login, newPassword: form.newPassword }, `${title}: password changed.`); }}>
                    <label>New password<PasswordInput required autoComplete="new-password" minLength={8} maxLength={200} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></label>
                    <p className="staff-muted">From now on only this password works for “{login}”. Personal logins are not affected.</p>
                    <div className="button-row"><button className="primary" disabled={busy}>{busy ? "Saving…" : "Save password"}</button><button type="button" onClick={() => setEditing(null)}>Cancel</button></div>
                  </form>
                )}
              </div>
              {editing !== `shared-${login}` && <div className="button-row">
                <button type="button" disabled={busy} onClick={() => { setEditing(`shared-${login}`); setForm({ username: "", newPassword: "" }); }}>Change password</button>
                {state.custom && state.fromEnvironment && <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Use the password from the server settings (Vercel) for “${login}” again?`)) run("account/shared-login", { login, useEnvironment: true }, `${title} uses the server setting again.`); }}>Use Vercel value again</button>}
              </div>}
            </li>
          );
        })}
        {staff.map((person) => (
          <li className="staff-staff-row" key={person.id}>
            <div>
              <strong>{person.name}</strong>
              <p className="staff-muted">{roleLabel(person.role)} · {person.username ? `personal login “${person.username}”${person.updatedAt ? ` · changed ${staffDateTime(person.updatedAt)}` : ""}` : "shared login"}</p>
              {editing === person.id && (
                <form className="staff-form staff-login-reset" onSubmit={(event) => { event.preventDefault(); run("account/set-password", { staffId: person.id, username: form.username, newPassword: form.newPassword }, `${person.name} can now sign in with “${person.username || form.username.trim().toLowerCase()}” and the new password.`); }}>
                  {!person.username && <label>Username<input required autoCapitalize="none" spellCheck={false} minLength={3} maxLength={40} pattern="[A-Za-z0-9._\-]{3,40}" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>}
                  <label>New password<PasswordInput required autoComplete="new-password" minLength={8} maxLength={200} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></label>
                  <div className="button-row"><button className="primary" disabled={busy}>{busy ? "Saving…" : "Save password"}</button><button type="button" onClick={() => setEditing(null)}>Cancel</button></div>
                </form>
              )}
            </div>
            {editing !== person.id && person.manageable && <div className="button-row">
              <button type="button" disabled={busy} onClick={() => { setEditing(person.id); setForm({ username: "", newPassword: "" }); }}>{person.username ? "Reset password" : "Set up login"}</button>
              {person.username && <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Remove ${person.name}'s personal login? They will use the shared login again.`)) run("account/reset", { staffId: person.id }, `${person.name} uses the shared login again.`); }}>Back to shared login</button>}
            </div>}
          </li>
        ))}
      </ul>
      {staff.length === 0 && <p className="staff-muted">No staff members yet. Add them in Content → Staff.</p>}
    </section>
  );
}

// Super Admin: the semester's tutor list (Tutors tab in the workbook).
export function TutorListPage() {
  const { session } = useOutletContext();
  const { workspace, error, busy, act } = useWorkspace();
  const [draft, setDraft] = useState(null);
  if (!canManage(session)) return <div className="staff-page"><h1>Tutors</h1><p>Only the Super Admin or the Coordinator can manage the tutor list.</p></div>;
  if (!workspace) return <State error={error} />;
  const saved = workspace.tutors || [];
  const names = draft ?? (saved.length ? saved : [""]);
  const set = (next) => setDraft(next);
  const cleaned = names.map((name) => name.trim()).filter(Boolean);
  const changed = cleaned.join("\n") !== saved.join("\n");
  const duplicate = cleaned.find((name, index) => cleaned.findIndex((other) => other.toLocaleLowerCase("en") === name.toLocaleLowerCase("en")) !== index);
  return (
    <div className="staff-page staff-tutor-list-page">
      <header className="staff-page-heading"><h1>Tutors <span className="staff-count">{cleaned.length}</span></h1></header>
      <p className="staff-muted">This semester's tutors. They are suggested in Shifts and listed in Statistics, and stored in the workbook's Tutors tab.</p>
      {error && <p role="alert">{error}</p>}
      <form className="staff-panel staff-form" onSubmit={async (event) => { event.preventDefault(); if (!busy && !duplicate && await act("tutors/save", { tutors: cleaned })) setDraft(null); }}>
        <ol className="staff-tutor-rows">
          {names.map((name, index) => (
            <li key={index}>
              <label><span className="staff-muted">Tutor {index + 1}</span><input maxLength={200} value={name} placeholder="Name" onChange={(e) => set(names.map((value, i) => (i === index ? e.target.value : value)))} /></label>
              <button type="button" aria-label={`Move Tutor ${index + 1} up`} disabled={index === 0} onClick={() => set(names.map((value, i) => (i === index - 1 ? names[index] : i === index ? names[index - 1] : value)))}>↑</button>
              <button type="button" className="content-delete-button" aria-label={`Delete ${name || `Tutor ${index + 1}`}`} onClick={() => set(names.filter((_, i) => i !== index))}>Delete</button>
            </li>
          ))}
        </ol>
        {duplicate && <p role="alert">“{duplicate}” is in the list twice.</p>}
        <div className="button-row">
          <button type="button" onClick={() => set([...names, ""])}>Add tutor</button>
          <button className="primary" disabled={busy || !changed || Boolean(duplicate)}>{busy ? "Saving…" : "Save tutor list"}</button>
          {changed && <button type="button" onClick={() => setDraft(null)}>Discard changes</button>}
        </div>
        <p className="staff-muted">Removing a tutor doesn't change shifts already in the schedule; their hours stay in Statistics under their name.</p>
      </form>
      {canManageLogins(session) && <StaffLogins session={session} />}
    </div>
  );
}

// Everyone starts on the shared login; here they can switch to their own username and password.
export function AccountPage() {
  const { session } = useOutletContext();
  const [account, setAccount] = useState(null), [form, setForm] = useState({ username: "", currentPassword: "", newPassword: "", confirmPassword: "" });
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    staffRequest("account").then((result) => { if (active) { setAccount(result); setForm((current) => ({ ...current, username: result.username })); } }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  async function save(event) {
    event.preventDefault();
    setError(""); setMessage("");
    if (form.newPassword !== form.confirmPassword) { setError("The new passwords don't match."); return; }
    setBusy(true);
    try {
      const result = await staffRequest("account/save", { csrf: session.csrf, body: form });
      setAccount({ personal: true, username: result.username, updatedAt: new Date().toISOString() });
      setForm({ username: result.username, currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage(`Saved. From now on, sign in with the username “${result.username}” and your new password.`);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  return (
    <div className="staff-page staff-account-page">
      <header className="staff-page-heading"><h1>My account</h1></header>
      <section className="staff-panel">
        <p><strong>{session.name}</strong> · {roleLabel(session.role)}</p>
        {!account ? <p role="status">{error || "Loading…"}</p> : <p className="staff-muted">{account.personal ? `You sign in with your personal username “${account.username}”.` : "You are using the shared login. Set your own username and password below if you like; the shared login then can no longer be used for your name."}</p>}
      </section>
      {!session.staffId ? <p>Choose your name first, then come back here.</p> : account && (
        <form className="staff-panel staff-form" onSubmit={save}>
          <h2>{account.personal ? "Change your login" : "Set up your personal login"}</h2>
          <label>Username<input required autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={40} pattern="[A-Za-z0-9._\-]{3,40}" value={form.username} onChange={set("username")} /></label>
          <label>{account.personal ? "Current password" : "Current password (the shared login password)"}<PasswordInput required autoComplete="current-password" value={form.currentPassword} onChange={set("currentPassword")} /></label>
          <label>New password<PasswordInput required autoComplete="new-password" minLength={8} maxLength={200} value={form.newPassword} onChange={set("newPassword")} /></label>
          <label>Repeat new password<PasswordInput required autoComplete="new-password" minLength={8} maxLength={200} value={form.confirmPassword} onChange={set("confirmPassword")} /></label>
          <p className="staff-muted">At least 8 characters. If you forget it, the Super Admin can reset your login so you can use the shared login again.</p>
          {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
          <button className="primary" disabled={busy}>{busy ? "Saving…" : "Save login"}</button>
        </form>
      )}
    </div>
  );
}

const ACTIVITY_TYPES = ["Shift Update", "Student Update", "Content Update", "Handover", "Other"];
// Super Admin: everything that changed, newest first, with who did it.
export function ChangeLogPage() {
  const { session } = useOutletContext();
  const [log, setLog] = useState(null), [error, setError] = useState(""), [type, setType] = useState(""), [query, setQuery] = useState("");
  useEffect(() => {
    if (!canManage(session)) return undefined;
    let active = true;
    staffRequest("activity").then((result) => { if (active) setLog(result.entries); }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [session]);
  if (!canManage(session)) return <div className="staff-page"><h1>Change log</h1><p>Only the Super Admin or the Coordinator can see the change log.</p></div>;
  if (!log) return <State error={error} />;
  const needle = query.trim().toLowerCase();
  const entries = log.filter((entry) => (!type || entry.type === type) && (!needle || `${entry.actor} ${entry.note} ${entry.studentName}`.toLowerCase().includes(needle)));
  return (
    <div className="staff-page staff-change-log-page">
      <header className="staff-page-heading"><h1>Change log <span className="staff-count">{entries.length}</span></h1></header>
      <div className="staff-student-toolbar">
        <label className="staff-search">Search<input type="search" placeholder="Name, tutor or change" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <label>Type<select value={type} onChange={(e) => setType(e.target.value)}><option value="">All changes</option>{ACTIVITY_TYPES.map((value) => <option key={value}>{value}</option>)}</select></label>
      </div>
      {entries.length === 0 ? <p className="staff-empty-state">No changes found.</p> : <div className="table-scroll">
        <table aria-label="Change log" className="staff-mobile-cards">
          <thead><tr><th>When</th><th>Who</th><th>Type</th><th>Student</th><th>Change</th></tr></thead>
          <tbody>{entries.map((entry) => <tr key={entry.id}><td data-label="When">{staffDateTime(entry.timestamp)}</td><td data-label="Who">{entry.actor}</td><td data-label="Type">{entry.type}</td><td data-label="Student">{entry.studentName || "—"}</td><td data-label="Change">{entry.note}</td></tr>)}</tbody>
        </table>
      </div>}
      <p className="staff-muted">The latest 500 changes. The full history stays in the workbook's Activity tab.</p>
    </div>
  );
}

export function ShiftPage() {
  const { session } = useOutletContext();
  const { workspace, error, busy, act, autosave } = useWorkspace();
  if (!workspace) return <State error={error} />;
  const times = workspace.shiftTimes || DEFAULT_SHIFT_TIMES;
  const days = new Map(workspace.data.shifts.map((day) => [day.date, day]));
  const saved = [...days.keys()].sort();
  // The semester period from the workbook decides which days are shown; otherwise show around today.
  const period = workspace.schedule || {};
  const monday = addDays(workspace.today, -((weekday(workspace.today) + 6) % 7));
  const lastSaved = saved.at(-1) || "";
  const first = period.start || (saved[0] && saved[0] < monday ? saved[0] : monday);
  const last = period.end || (lastSaved > addDays(first, 13) ? lastSaved : addDays(first, 13));
  const dates = [];
  // Cap at a year so a mistyped date can't render thousands of rows.
  for (let date = first; date <= last && dates.length < 366; date = addDays(date, 1)) dates.push(date);
  const tutorNames = (workspace.tutors || []).filter(Boolean);
  const names = [...new Set([...tutorNames, ...(tutorNames.length ? [] : workspace.data.programTutors.map((tutor) => tutor.tutor))].filter((name) => name && name !== "?"))];
  return (
    <div className="staff-page staff-schedule-page">
      <header className="staff-page-heading"><h1>Shifts</h1></header>
      {error && <p role="alert">{error}</p>}
      {!workspace.unified ? <p>The shift schedule needs the Welcome Lounge workbook.</p> : <>
        {canManage(session) && <ScheduleSetup key={workspace.etag} workspace={workspace} busy={busy} act={act} />}
        <p className="staff-muted">{period.start && period.end ? `${period.start} to ${period.end}. ` : ""}{canManage(session) ? "Type a name in any cell; changes save automatically. For a closed day, clear the names and write the reason in Note." : "Use “+ Add me” to take a shift and × to leave it; changes save automatically."}</p>
        <datalist id="staff-shift-names">{names.map((name) => <option key={name} value={name} />)}</datalist>
        <div className="table-scroll">
          <table className="staff-shift-table" aria-label="Shift schedule">
            <thead>
              <tr>
                <th>Date</th>
                {SLOT_KEYS.flatMap(([slot, n]) => [1, 2, 3, 4].map((p) => <th key={`${slot}${p}`} className={n === 1 ? "staff-shift-s1" : "staff-shift-s2"}>{p === 1 ? `S${n} (${times[slot]}) – Person 1` : `S${n} – Person ${p}`}</th>))}
                <th>Note</th>
                <th><span className="sr-only">Save status</span></th>
              </tr>
            </thead>
            <tbody>
              {dates.map((date) => <ShiftDayRow key={date} date={date} day={days.get(date)} me={session.name} editAll={canManage(session)} save={(patch, base) => autosave("shifts/day", date, patch, base)} />)}
            </tbody>
          </table>
        </div>
      </>}
    </div>
  );
}
export function StatisticsPage() {
  const { session } = useOutletContext();
  const { workspace, error } = useWorkspace();
  if (!canManage(session)) return <div className="staff-page"><h1>Statistics</h1><p>Only the Super Admin or the Coordinator can see statistics.</p></div>;
  if (!workspace) return <State error={error} />;
  const shiftTimes = workspace.shiftTimes || DEFAULT_SHIFT_TIMES;
  const rows = tutorStatistics({ shifts: workspace.data.shifts, shiftTimes, tutors: workspace.tutors, schedule: workspace.schedule, today: workspace.today });
  const fair = fairShare({ shifts: workspace.data.shifts, shiftTimes, tutors: workspace.tutors, schedule: workspace.schedule });
  const max = Math.max(1, fair?.perTutor || 0, ...rows.map((row) => row.total));
  const difference = (hours) => { const value = Math.round((hours - fair.perTutor) * 10) / 10; return value === 0 ? "±0 h" : `${value > 0 ? "+" : "−"}${formatHours(Math.abs(value))}`; };
  const unreadable = [shiftTimes.first, shiftTimes.second].filter((range) => shiftHours(range) === null);
  return (
    <div className="staff-page staff-statistics-page">
      <header className="staff-page-heading"><h1>Statistics</h1></header>
      {fair ? <p className="staff-fair-share"><strong>Fair share: {formatHours(Math.round(fair.perTutor * 10) / 10)} per tutor</strong> <span className="staff-muted">({fair.openDays} open days × 2 shifts × {fair.perShift} tutors = {formatHours(fair.totalHours)} ÷ {fair.tutorCount} tutors)</span></p>
        : <p className="staff-muted">Set the first and last day in Shifts → Semester setup and add tutors to see the fair share per tutor.</p>}
      {unreadable.length > 0 && <p role="alert">Shift time “{unreadable.join("”, “")}” can’t be read as hours. Use a format like 10:00–13:00 in Semester setup.</p>}
      {rows.length === 0 ? <p className="staff-empty-state">No tutors or shifts yet. Add tutor names on the Tutors page.</p> : <>
        <section className="staff-panel staff-hours-chart" aria-labelledby="hours-chart-heading">
          <div className="staff-section-header">
            <h2 id="hours-chart-heading">Hours per tutor</h2>
            <p className="staff-chart-legend"><span className="is-done" aria-hidden="true" />Worked <span className="is-planned" aria-hidden="true" />Planned{fair && <><span className="is-fair" aria-hidden="true" />Fair share</>}</p>
          </div>
          <ul>
            {rows.map((row) => (
              <li key={row.name} title={`${row.name}: ${formatHours(row.done)} worked, ${formatHours(row.planned)} planned (S1 ${row.first}×, S2 ${row.second}×)`}>
                <span className="staff-bar-label">{row.name}</span>
                <span className="staff-bar-track" aria-hidden="true">
                  {fair && <span className="staff-bar-fair" style={{ left: `${(fair.perTutor / max) * 100}%` }} />}
                  {row.done > 0 && <span className="staff-bar is-done" style={{ width: `${(row.done / max) * 100}%` }} />}
                  {row.planned > 0 && <span className="staff-bar is-planned" style={{ width: `${(row.planned / max) * 100}%` }} />}
                </span>
                <span className="staff-bar-value">{formatHours(row.total)}</span>
              </li>
            ))}
          </ul>
        </section>
        <div className="table-scroll">
          <table aria-label="Hours per tutor" className="staff-mobile-cards">
            <thead><tr><th>Tutor</th><th>S1 shifts</th><th>S2 shifts</th><th>Worked</th><th>Planned</th><th>Total</th>{fair && <th>vs. fair share</th>}</tr></thead>
            <tbody>{rows.map((row) => <tr key={row.name}><td data-label="Tutor">{row.name}</td><td data-label="S1 shifts">{row.first}</td><td data-label="S2 shifts">{row.second}</td><td data-label="Worked">{formatHours(row.done)}</td><td data-label="Planned">{formatHours(row.planned)}</td><td data-label="Total"><strong>{formatHours(row.total)}</strong></td>{fair && <td data-label="vs. fair share">{difference(row.total)}</td>}</tr>)}</tbody>
          </table>
        </div>
      </>}
    </div>
  );
}
export function Tutors() {
  const { workspace, error } = useWorkspace();
  return !workspace ? (
    <State error={error} />
  ) : (
    <div className="staff-page">
      <header className="staff-page-heading"><h1>Programme tutors</h1></header>
      <div className="staff-dashboard-grid">
      {workspace.data.programTutors.map((t, i) => (
        <section key={i} className="staff-dashboard-section">
          <h2>{t.program}</h2>
          <p>{t.tutor === "?" ? "Not assigned" : t.tutor}</p>
          {t.email && <p>{t.email}</p>}
          {t.phone && <p>{t.phone}</p>}
          {t.telegram && <p>{t.telegram}</p>}
        </section>
      ))}
      </div>
      {!workspace.data.programTutors.length && <p className="staff-empty-state">No tutors listed.</p>}
    </div>
  );
}
export function Handover() {
  const { workspace, error, busy, act } = useWorkspace();
  const [note, setNote] = useState(""), [studentId, setStudentId] = useState("");
  if (!workspace) return <State error={error} />;
  return (
    <div className="staff-page staff-handover-page">
      <header className="staff-page-heading"><h1>Handover</h1></header>
      {error && <p role="alert">{error}</p>}
      <form
        className="staff-form staff-handover-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          if (await act("handover", { note, studentId })) { setNote(""); setStudentId(""); }
        }}
      >
        <label>
          Note for next shift
          <textarea
            required
            rows={3}
            maxLength={4000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="staff-handover-controls">
          <label>Student (optional)<select value={studentId} onChange={(e) => setStudentId(e.target.value)}><option value="">General handover</option>{workspace.data.students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
          <button className="primary" disabled={busy || !note.trim()}>{busy ? "Saving…" : "Add handover"}</button>
        </div>
      </form>
      <div className="staff-handover-feed"><HandoverEntries entries={workspace.data.handover} today={workspace.today} /></div>
    </div>
  );
}
