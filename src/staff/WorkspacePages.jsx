import { useState } from "react";
import { Link, useParams, useOutletContext, useSearchParams } from "react-router-dom";
import { useWorkspace } from "./useWorkspace";
import { AUTOSAVE_TOGGLE_DELAY, useAutosave } from "./useAutosave";
import { SaveStatus } from "./SaveStatus";
import { COUNTRY_OPTIONS, STUDY_PROGRAM_OPTIONS } from "./studentOptions";
const status = (value) =>
  value === true ? "Yes" : value === false ? "No" : "Unknown";
const localDateInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const emptyStudent = () => ({ name: "", matriculationNumber: "", country: "", studyProgram: "", phone: "", email: "", notes: "", dateAdded: localDateInput() });
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
function StudentTable({ students }) {
  if (!students.length) return <p className="staff-empty-state">No students found.</p>;
  return (
    <div className="table-scroll">
      <table aria-label="Student records">
        <thead>
          <tr>
            <th>Name</th>
            <th>Matriculation no.</th>
            <th>Study program</th>
            <th>Enrolled</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td>
                <Link to={`/staff/students/${s.id}`}>
                  {s.name || "Name not supplied"}
                </Link>
              </td>
              <td>{s.matriculationNumber || "—"}</td>
              <td>{s.studyProgram || "—"}</td>
              <td>{status(s.enrolled)}</td>
            </tr>
          ))}
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

function TodayCheckins({ checkins, students }) {
  const recent = checkins.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return recent.length ? (
    <ul className="staff-activity-list">
      {recent.slice(0, 8).map((checkin) => {
        const student = students.find((item) => item.id === checkin.studentId);
        return (
          <li key={checkin.id}>
            <Link to={`/staff/students/${checkin.studentId}`}>
              {student?.name || "Student record"}
            </Link>
            <small>Checked in by {checkin.actor.name} · {staffDateTime(checkin.timestamp)}</small>
          </li>
        );
      })}
    </ul>
  ) : <p className="staff-empty-state">No check-ins yet.</p>;
}

function AttentionList({ students }) {
  return students.length ? (
    <ul className="staff-attention-list">
      {students.map((student) => {
        return (
          <li key={student.id}>
            <Link to={`/staff/students/${student.id}`}>
              {student.name || "Name not supplied"}
            </Link>
            <small>{student.enrolled === false ? "Not enrolled" : "Enrollment unknown"}</small>
          </li>
        );
      })}
    </ul>
  ) : <p className="staff-empty-state">No follow-up needed.</p>;
}

export function Dashboard() {
  const { session } = useOutletContext();
  const { workspace, error } = useWorkspace();
  if (!workspace) return <State error={error} />;
  const { data, today } = workspace;
  const shifts = data.shifts.filter((s) => s.date === today);
  const checkinsToday = data.checkins.filter((checkin) => checkin.date === today);
  const attentionStudents = data.students.filter((student) => student.enrolled !== true);
  const dayLabel = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeZone: "Europe/Berlin",
  }).format(new Date(`${today}T12:00:00Z`));
  const setupItems = [
    !data.semesterLabel && {
      title: "Set the semester",
      to: session?.role === "admin" ? "/staff/content" : null,
    },
    data.shifts.length === 0 && session?.role === "admin" && {
      title: "Add shifts",
      to: "/staff/shifts",
    },
  ].filter(Boolean);
  return (
    <div className="staff-page staff-dashboard">
      <header className="staff-page-heading staff-dashboard-heading">
        <div><h1>Today</h1><p className="staff-page-meta">{dayLabel}</p></div>
        <p className="staff-checkin-count"><strong>{checkinsToday.length}</strong> checked in</p>
      </header>
          <nav className="staff-quick-actions" aria-label="Today’s actions">
            <Link to="/staff/students">Find & check in <span aria-hidden="true">→</span></Link>
            <Link to="/staff/handover">Add handover <span aria-hidden="true">→</span></Link>
          </nav>
          {setupItems.length > 0 && <aside className="staff-setup-inline" aria-label="Workspace setup">
            <strong>Setup</strong>
            {setupItems.map((item) => item.to
              ? <Link key={item.title} to={item.to}>{item.title} <span aria-hidden="true">→</span></Link>
              : <span key={item.title}>Semester not set · Contact a coordinator</span>)}
          </aside>}
          <div className="staff-dashboard-grid">
            <section className="staff-dashboard-section" aria-labelledby="today-shifts-heading">
              <div className="staff-section-header"><h2 id="today-shifts-heading">On duty</h2><Link to="/staff/shifts">Schedule</Link></div>
              <Shifts shifts={shifts} compact />
            </section>
            <section className="staff-dashboard-section" aria-labelledby="today-checkins-heading">
              <div className="staff-section-header"><h2 id="today-checkins-heading">Latest check-ins</h2>{checkinsToday.length > 8 && <Link to="/staff/reports">View all</Link>}</div>
              <TodayCheckins checkins={checkinsToday} students={data.students} />
            </section>
            <section className="staff-dashboard-section" aria-labelledby="attention-heading">
              <div className="staff-section-header"><h2 id="attention-heading">Needs attention <span className="staff-count">{attentionStudents.length}</span></h2>{attentionStudents.length > 0 && <Link to="/staff/students?filter=attention">View all</Link>}</div>
              <AttentionList students={attentionStudents.slice(0, 5)} />
            </section>
            <section className="staff-dashboard-section" aria-labelledby="handover-heading">
              <div className="staff-section-header"><h2 id="handover-heading">Latest handover</h2>{data.handover.length > 0 && <Link to="/staff/handover">View all</Link>}</div>
              <HandoverEntries entries={data.handover} today={today} limit={3} />
            </section>
          </div>
    </div>
  );
}
export function Students() {
  const { workspace, error, busy, act } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(""),
    [newStudent, setNewStudent] = useState(emptyStudent);
  if (!workspace) return <State error={error} />;
  const attentionOnly = searchParams.get("filter") === "attention";
  const students = workspace.data.students.filter(
    (s) =>
      (!attentionOnly || s.enrolled !== true) && `${s.name} ${s.matriculationNumber} ${s.country} ${s.studyProgram}`
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
      </div>
      {workspace.unified && <details className="staff-disclosure">
        <summary>Add student</summary>
        <form className="staff-form staff-student-create-form staff-form-grid" aria-busy={busy} onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          if (await act("students/create", newStudent)) setNewStudent(emptyStudent());
        }}>
          {error && <p className="staff-student-create-error" role="alert">{error}</p>}
          <label>Full name<input required maxLength={200} value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} /></label>
          <label>Matriculation number<input inputMode="numeric" maxLength={100} value={newStudent.matriculationNumber} onChange={(e) => setNewStudent({ ...newStudent, matriculationNumber: e.target.value })} /></label>
          <SuggestedInput label="Country" name="country" value={newStudent.country} options={COUNTRY_OPTIONS} onChange={(country) => setNewStudent({ ...newStudent, country })} maxLength={200} />
          <SuggestedInput label="Study programme" name="study-program" value={newStudent.studyProgram} options={studyProgramOptions(workspace)} onChange={(studyProgram) => setNewStudent({ ...newStudent, studyProgram })} />
          <label>Phone number<input type="tel" maxLength={100} value={newStudent.phone} onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })} /></label>
          <label>Email<input type="email" maxLength={254} value={newStudent.email} onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })} /></label>
          <label className="staff-field-wide">Notes<textarea rows={2} maxLength={4000} value={newStudent.notes} onChange={(e) => setNewStudent({ ...newStudent, notes: e.target.value })} /></label>
          <div className="staff-student-create-controls staff-field-wide"><label>Date added<input type="date" value={newStudent.dateAdded} readOnly /></label><button className="primary" disabled={busy}>{busy ? "Adding…" : "Add student"}</button></div>
        </form>
      </details>}
      <StudentTable students={students} />
    </div>
  );
}
function StudentEditor({ student, save, programOptions }) {
  const autosave = useAutosave({
    enrolled: student.enrolled,
    accommodation: student.accommodation,
    cityRegistration: student.cityRegistration,
    address: student.address,
    country: student.country,
    studyProgram: student.studyProgram,
    notes: student.notes,
    phone: student.phone || "",
    email: student.email || "",
  }, save, { validate: (draft) => draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email) ? "Enter a valid email address." : "" });
  const { draft, setField } = autosave;
  return (
    <div className="staff-form staff-student-editor">
      <div className="staff-autosave-position"><SaveStatus {...autosave} onRetry={autosave.retry} onUseMine={() => autosave.resolveConflict(true)} onUseLatest={() => autosave.resolveConflict(false)} /></div>
      <fieldset className="staff-fieldset">
        <legend>Personal details</legend>
        <div className="staff-form-grid">
          <SuggestedInput label="Country" name="country" value={draft.country} options={COUNTRY_OPTIONS} onChange={(value) => setField("country", value)} maxLength={200} />
          <SuggestedInput label="Study programme" name="study-program" value={draft.studyProgram} options={programOptions} onChange={(value) => setField("studyProgram", value)} />
          <label>Phone number<input type="tel" maxLength={100} value={draft.phone} onChange={(e) => setField("phone", e.target.value)} /></label>
          <label>Email<input type="email" maxLength={254} value={draft.email} onChange={(e) => setField("email", e.target.value)} /></label>
          <label className="staff-field-wide">Address<textarea rows={2} maxLength={12000} value={draft.address || ""} onChange={(e) => setField("address", e.target.value)} /></label>
        </div>
      </fieldset>
      <fieldset className="staff-fieldset">
        <legend>Arrival</legend>
        <div className="staff-form-grid">
          <label className="staff-field-wide">
            Enrolled
            <select value={String(draft.enrolled ?? null)} onChange={(e) => setField("enrolled", e.target.value === "null" ? null : e.target.value === "true", AUTOSAVE_TOGGLE_DELAY)}>
              <option value="null">Unknown</option><option value="true">Yes</option><option value="false">No</option>
            </select>
          </label>
          {[["accommodation", "Accommodation"], ["cityRegistration", "City registration appointment"]].map(([field, label]) => (
            <label className="staff-field-wide" key={field}>{label}<textarea rows={2} maxLength={12000} value={draft[field] || ""} onChange={(e) => setField(field, e.target.value)} /></label>
          ))}
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
  const { workspace, error, busy, act, autosave } = useWorkspace();
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
  const recentCheckins = workspace.data.checkins
    .filter((entry) => entry.studentId === s.id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 5);
  const fieldNames = {
    enrolled: "Enrollment",
    receivedBackpack: "Welcome materials",
    accommodation: "Accommodation",
    cityRegistration: "City registration appointment",
    notes: "Note / Comment",
    address: "Address",
    country: "Country",
    studyProgram: "Study programme",
    phone: "Phone number",
    email: "Email",
  };
  const checkedInToday = workspace.data.checkins.some((checkin) => checkin.studentId === s.id && checkin.date === workspace.today);
  return (
    <div className="staff-page staff-student-detail">
      <Link className="staff-back-link" to="/staff/students"><span aria-hidden="true">← </span>Students</Link>
      <header className="staff-page-heading staff-record-header">
        <div><h1>{s.name || "Student record"}</h1><p className="staff-page-meta">{[s.studyProgram, s.matriculationNumber ? `No. ${s.matriculationNumber}` : "No matriculation number"].filter(Boolean).join(" · ")}</p></div>
        <button className={checkedInToday ? "staff-status is-complete" : "primary"} disabled={busy || checkedInToday} onClick={() => act("checkin", { id: s.id })}>
          {checkedInToday ? "✓ Checked in today" : busy ? "Checking in…" : "Check in today"}
        </button>
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
      {recentCheckins.length > 0 && (
        <details className="staff-record-history staff-disclosure">
          <summary>Check-in history</summary>
          {recentCheckins.map((entry) => (
            <article className="staff-handover-entry" key={entry.id}>
              <small>{entry.actor.name} · {staffDateTime(entry.timestamp)}</small>
            </article>
          ))}
        </details>
      )}
    </div>
  );
}
function Shifts({ shifts, onEdit, compact = false }) {
  return shifts.length ? (
    shifts.map((s, i) => (
      <section className="staff-shift-row" key={s.id || i}>
        {!compact && <h3><time dateTime={s.date}>{s.date}</time></h3>}
        {s.start && s.end && <p className="staff-shift-time">{s.start}–{s.end}</p>}
        <p>{(s.tutors || [...(s.first || []), ...(s.second || [])]).filter(Boolean).join(", ") || "Tutors not assigned"}</p>
        {s.event && <p className="source-text">{s.event}</p>}
        {s.notes && <p className="source-text">{s.notes}</p>}
        {onEdit && <button type="button" onClick={() => onEdit({ id: s.id, date: s.date, start: s.start || "", end: s.end || "", tutor1: (s.tutors || [])[0] || "", tutor2: (s.tutors || [])[1] || "", tutor3: (s.tutors || [])[2] || "", event: s.event || "", notes: s.notes || "" })}>Edit shift</button>}
      </section>
    ))
  ) : (
    <p className="staff-empty-state">No shifts scheduled.</p>
  );
}
const emptyShift = () => ({ date: "", start: "", end: "", tutor1: "", tutor2: "", tutor3: "", event: "", notes: "" });
function ExistingShiftEditor({ shift, save, onDone }) {
  const autosave = useAutosave({ date: shift.date, start: shift.start, end: shift.end, tutors: [shift.tutor1 || "", shift.tutor2 || "", shift.tutor3 || ""], event: shift.event, notes: shift.notes }, save);
  const setTutor = (index, value) => {
    const tutors = [...autosave.draft.tutors];
    tutors[index] = value;
    autosave.setField("tutors", tutors);
  };
  return <div className="staff-form staff-form-grid">
    <div className="staff-autosave-position"><SaveStatus {...autosave} onRetry={autosave.retry} onUseMine={() => autosave.resolveConflict(true)} onUseLatest={() => autosave.resolveConflict(false)} /></div>
    <label>Date<input required type="date" value={autosave.draft.date} onChange={(e) => autosave.setField("date", e.target.value)} /></label>
    <label>Start<input type="time" value={autosave.draft.start} onChange={(e) => autosave.setField("start", e.target.value, AUTOSAVE_TOGGLE_DELAY)} /></label>
    <label>End<input type="time" value={autosave.draft.end} onChange={(e) => autosave.setField("end", e.target.value, AUTOSAVE_TOGGLE_DELAY)} /></label>
    {[0, 1, 2].map((index) => <label key={index}>Tutor {index + 1}<input value={autosave.draft.tutors[index] || ""} onChange={(e) => setTutor(index, e.target.value)} /></label>)}
    <label className="staff-field-wide">Event<input value={autosave.draft.event} onChange={(e) => autosave.setField("event", e.target.value)} /></label>
    <label className="staff-field-wide">Notes<textarea rows={2} value={autosave.draft.notes} onChange={(e) => autosave.setField("notes", e.target.value)} /></label>
    <button type="button" disabled={autosave.hasUnsavedChanges || autosave.status === "saving" || autosave.status === "error" || autosave.status === "conflict"} onClick={onDone}>Close editor</button>
  </div>;
}
export function ShiftPage() {
  const { session } = useOutletContext();
  const { workspace, error, busy, act, autosave } = useWorkspace();
  const [shift, setShift] = useState(emptyShift);
  return !workspace ? (
    <State error={error} />
  ) : (
    <div className="staff-page staff-schedule-page">
      <header className="staff-page-heading"><h1>Schedule</h1></header>
      {error && <p role="alert">{error}</p>}
      {workspace.unified && session.role === "admin" && (shift.id ? <section className="staff-disclosure staff-shift-editor"><h2>Edit shift</h2><ExistingShiftEditor key={shift.id} shift={shift} save={(patch, base) => autosave("shifts/autosave", shift.id, patch, base)} onDone={() => setShift(emptyShift())} /></section> : <details className="staff-disclosure"><summary>Add shift</summary><form className="staff-form staff-form-grid" onSubmit={async (event) => { event.preventDefault(); if (!busy && await act("shifts/save", { shift })) setShift(emptyShift()); }}>
        <label>Date<input required type="date" value={shift.date} onChange={(e) => setShift({ ...shift, date: e.target.value })} /></label>
        <label>Start<input type="time" value={shift.start} onChange={(e) => setShift({ ...shift, start: e.target.value })} /></label>
        <label>End<input type="time" value={shift.end} onChange={(e) => setShift({ ...shift, end: e.target.value })} /></label>
        {[1, 2, 3].map((n) => <label key={n}>Tutor {n}<input value={shift[`tutor${n}`]} onChange={(e) => setShift({ ...shift, [`tutor${n}`]: e.target.value })} /></label>)}
        <label className="staff-field-wide">Event<input value={shift.event} onChange={(e) => setShift({ ...shift, event: e.target.value })} /></label>
        <label className="staff-field-wide">Notes<textarea rows={2} value={shift.notes} onChange={(e) => setShift({ ...shift, notes: e.target.value })} /></label>
        <button className="primary" disabled={busy}>{busy ? "Adding…" : "Add shift"}</button>
      </form></details>)}
      <div className="staff-shift-list"><Shifts shifts={workspace.data.shifts} onEdit={workspace.unified && session.role === "admin" ? setShift : null} /></div>
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
export function Reports() {
  const { workspace, error } = useWorkspace();
  const [date, setDate] = useState("");
  if (!workspace) return <State error={error} />;
  const selected = date || workspace.today,
    checkins = workspace.data.checkins.filter((c) => c.date === selected),
    handover = workspace.data.handover.filter((c) => c.date === selected);
  function download() {
    const csv = `Date,Check-ins,Handover entries\r\n${selected},${checkins.length},${handover.length}\r\n`;
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `welcome-lounge-${selected}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="staff-page staff-reports-page">
      <header className="staff-page-heading"><h1>Daily report</h1><button onClick={download}>Download CSV</button></header>
      <div className="staff-report-summary">
      <label className="staff-report-date">
        Report date
        <input
          type="date"
          value={selected}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <p>
        {checkins.length} check-ins · {handover.length} handover entries
      </p>
      </div>
      <div className="staff-dashboard-grid">
      <section className="staff-dashboard-section"><h2>Check-ins</h2>
      {checkins.length ? <ul className="staff-activity-list">{checkins.map((c) => (
        <li key={c.id}><Link to={`/staff/students/${c.studentId}`}>{workspace.data.students.find((s) => s.id === c.studentId)?.name || "Student"}</Link><small>{c.actor.name} · {staffDateTime(c.timestamp)}</small></li>
      ))}</ul> : <p className="staff-empty-state">No check-ins.</p>}
      </section>
      <section className="staff-dashboard-section"><h2>Handover</h2>
      {handover.map((n) => (
        <article key={n.id} className="staff-handover-entry"><p className="source-text">{n.note}</p><small>{n.author} · {staffDateTime(n.timestamp)}</small></article>
      ))}
      {!handover.length && <p className="staff-empty-state">No handover notes.</p>}
      </section>
      </div>
    </div>
  );
}
