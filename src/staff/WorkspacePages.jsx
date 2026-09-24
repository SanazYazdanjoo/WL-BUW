import { useEffect, useState } from "react";
import { Link, useParams, useOutletContext, useSearchParams } from "react-router-dom";
import { useWorkspace } from "./useWorkspace";
import { staffRequest } from "./service";
import { AUTOSAVE_TOGGLE_DELAY, useAutosave } from "./useAutosave";
import { SaveStatus } from "./SaveStatus";
import { COUNTRY_OPTIONS, STUDY_PROGRAM_OPTIONS } from "./studentOptions";
import { formatHours, shiftHours, tutorStatistics } from "./statistics";
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
// Excel export of the students checked in (or added) on a chosen day; built on the server.
function StudentExport({ workspace }) {
  const [date, setDate] = useState(workspace.today), [by, setBy] = useState("checkin");
  const count = by === "added"
    ? workspace.data.students.filter((student) => student.legacyDate === date).length
    : new Set(workspace.data.checkins.filter((checkin) => checkin.date === date).map((checkin) => checkin.studentId)).size;
  return (
    <details className="staff-disclosure staff-student-export">
      <summary>Export students for a day</summary>
      <div className="staff-form staff-form-grid">
        <label>Day<input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>Students<select value={by} onChange={(e) => setBy(e.target.value)}><option value="checkin">Checked in on this day</option><option value="added">Added on this day</option></select></label>
        <p className="staff-muted staff-field-wide">{count} student{count === 1 ? "" : "s"} · Excel file with all student details{by === "checkin" ? ", check-in time and who checked them in" : ""}.</p>
        {date ? <a className="staff-export-link" href={`/api/staff/students/export?date=${encodeURIComponent(date)}&by=${by}`} download>Download Excel</a> : <p className="staff-muted">Choose a day.</p>}
      </div>
    </details>
  );
}
// Every student field is edited right in the table. Checkboxes save almost
// immediately, text after a short pause; the server logs who changed what.
const STUDENT_TEXT_COLUMNS = [
  ["name", "Full name", 200],
  ["matriculationNumber", "Matriculation no.", 100],
  ["country", "Country", 200, "staff-country-options"],
  ["studyProgram", "Study program", 300, "staff-program-options"],
  ["phone", "Phone", 100],
  ["email", "Email", 254],
  ["address", "Address", 12000],
];
const STUDENT_CHECK_COLUMNS = [["enrolled", "Enrolled"], ["receivedBackpack", "Welcome materials"], ["accommodation", "Accommodation"]];
const studentRowDraft = (student) => ({
  ...Object.fromEntries(STUDENT_TEXT_COLUMNS.map(([field]) => [field, String(student[field] ?? "")])),
  // Keep stored values (null = unknown) so the server sees the right base on first change.
  enrolled: student.enrolled ?? null,
  receivedBackpack: student.receivedBackpack ?? null,
  accommodation: student.accommodation ?? null,
  accommodationContact: student.accommodationContact || "",
  cityRegistration: student.cityRegistration ?? null,
  notes: student.notes || "",
});
const studentRowProblem = (draft) => (!draft.name.trim() ? "Enter the student's full name." : draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email) ? "Enter a valid email address." : "");

function StudentRow({ student, save, checkedIn, onCheckIn, busy }) {
  const autosave = useAutosave(studentRowDraft(student), save, { validate: studentRowProblem });
  const { draft, setField } = autosave;
  const who = draft.name || "student";
  const text = ([field, label, maxLength, list]) => <td key={field} className={field === "name" ? "staff-cell-sticky" : undefined}><input className="staff-cell-input" aria-label={`${label} · ${who}`} list={list} type={field === "email" ? "email" : "text"} maxLength={maxLength} value={draft[field]} onChange={(e) => setField(field, e.target.value)} /></td>;
  const check = ([field, label]) => <td key={field} className="staff-cell-check"><input type="checkbox" aria-label={`${label} · ${who}`} checked={draft[field] === true} onChange={(e) => setField(field, e.target.checked, AUTOSAVE_TOGGLE_DELAY)} /></td>;
  return (
    <tr>
      {STUDENT_TEXT_COLUMNS.map(text)}
      {STUDENT_CHECK_COLUMNS.map(check)}
      <td><input className="staff-cell-input" aria-label={`Contact (if no accommodation) · ${who}`} maxLength={1000} disabled={draft.accommodation === true} placeholder={draft.accommodation === true ? "" : "Phone, email or address"} value={draft.accommodationContact} onChange={(e) => setField("accommodationContact", e.target.value)} /></td>
      {check(["cityRegistration", "City registration appointment"])}
      <td><input className="staff-cell-input staff-cell-note" aria-label={`Note · ${who}`} maxLength={4000} value={draft.notes} onChange={(e) => setField("notes", e.target.value)} /></td>
      <td>{checkedIn ? <span className="staff-status is-complete">✓ Today</span> : <button type="button" disabled={busy} onClick={onCheckIn}>Check in</button>}</td>
      <td className="staff-cell-status"><SaveStatus {...autosave} onRetry={autosave.retry} onUseMine={() => autosave.resolveConflict(true)} onUseLatest={() => autosave.resolveConflict(false)} /></td>
    </tr>
  );
}
function StudentTable({ students, save, checkedInIds, onCheckIn, busy, programOptions }) {
  if (!students.length) return <p className="staff-empty-state">No students found.</p>;
  return (
    <div className="table-scroll">
      <datalist id="staff-country-options">{COUNTRY_OPTIONS.map((option) => <option key={option} value={option} />)}</datalist>
      <datalist id="staff-program-options">{programOptions.map((option) => <option key={option} value={option} />)}</datalist>
      <table aria-label="Student records" className="staff-student-table">
        <thead>
          <tr>
            {STUDENT_TEXT_COLUMNS.map(([field, label]) => <th key={field} className={field === "name" ? "staff-cell-sticky" : undefined}>{label}</th>)}
            {STUDENT_CHECK_COLUMNS.map(([field, label]) => <th key={field}>{label}</th>)}
            <th>Contact (if no accommodation)</th>
            <th>City registration appointment</th>
            <th>Note</th>
            <th>Check-in</th>
            <th><span className="sr-only">Save status</span></th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => <StudentRow key={s.id} student={s} busy={busy} checkedIn={checkedInIds.has(s.id)} onCheckIn={() => onCheckIn(s.id)} save={(patch, base) => save(s.id, patch, base)} />)}
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
  const todayShift = data.shifts.find((s) => s.date === today);
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
              <TodayShifts day={todayShift} times={workspace.shiftTimes || DEFAULT_SHIFT_TIMES} />
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
  const { workspace, error, busy, act, autosave } = useWorkspace();
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
      {workspace.unified && <StudentExport workspace={workspace} />}
      <StudentTable
        students={students}
        busy={busy}
        programOptions={studyProgramOptions(workspace)}
        checkedInIds={new Set(workspace.data.checkins.filter((checkin) => checkin.date === workspace.today).map((checkin) => checkin.studentId))}
        onCheckIn={(id) => act("checkin", { id })}
        save={(id, patch, base) => autosave("students/update", id, patch, base)}
      />
    </div>
  );
}
function StudentEditor({ student, save, programOptions }) {
  const autosave = useAutosave({
    name: student.name || "",
    matriculationNumber: String(student.matriculationNumber || ""),
    enrolled: student.enrolled,
    receivedBackpack: student.receivedBackpack,
    accommodation: student.accommodation ?? null,
    accommodationContact: student.accommodationContact || "",
    cityRegistration: student.cityRegistration ?? null,
    address: student.address,
    country: student.country,
    studyProgram: student.studyProgram,
    notes: student.notes,
    phone: student.phone || "",
    email: student.email || "",
  }, save, { validate: (draft) => !draft.name.trim() ? "Enter the student's full name." : draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email) ? "Enter a valid email address." : "" });
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
          <label>Phone number<input type="tel" maxLength={100} value={draft.phone} onChange={(e) => setField("phone", e.target.value)} /></label>
          <label>Email<input type="email" maxLength={254} value={draft.email} onChange={(e) => setField("email", e.target.value)} /></label>
          <label className="staff-field-wide">Address<textarea rows={2} maxLength={12000} value={draft.address || ""} onChange={(e) => setField("address", e.target.value)} /></label>
        </div>
      </fieldset>
      <fieldset className="staff-fieldset">
        <legend>Arrival</legend>
        <div className="staff-form-grid">
          {[["enrolled", "Enrolled"], ["receivedBackpack", "Welcome materials received"]].map(([field, label]) => (
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
    name: "Name",
    matriculationNumber: "Matriculation number",
    enrolled: "Enrollment",
    receivedBackpack: "Welcome materials",
    accommodation: "Accommodation",
    accommodationContact: "Contact (if no accommodation)",
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

function TodayShifts({ day, times }) {
  if (!day) return <p className="staff-empty-state">No shifts scheduled.</p>;
  return <>
    {day.event && <p className="staff-shift-note">{day.event}</p>}
    {SLOT_KEYS.map(([slot, n]) => <section className="staff-shift-row" key={slot}>
      <p className="staff-shift-time">S{n} · {times[slot]}</p>
      <p>{day[slot].filter(Boolean).join(", ") || "Nobody assigned"}</p>
    </section>)}
  </>;
}

// One day of the schedule; each cell autosaves and the server logs who changed what.
function ShiftDayRow({ date, day, save }) {
  const autosave = useAutosave(shiftDraft(day), save);
  const { draft, setField } = autosave;
  const weekend = [0, 6].includes(weekday(date));
  const people = SLOT_KEYS.flatMap(([, n]) => [1, 2, 3, 4].map((p) => `s${n}p${p}`));
  // Use saved values so the layout doesn't switch (and steal focus) while someone is typing.
  const closed = Boolean(day?.event) && ![...day.first, ...day.second].some(Boolean);
  const cell = (field, label) => <input className="staff-cell-input" list="staff-shift-names" aria-label={`${label} · ${date}`} maxLength={200} value={draft[field]} onChange={(e) => setField(field, e.target.value)} />;
  return (
    <tr className={closed ? "is-closed" : weekend ? "is-weekend" : undefined}>
      <th scope="row" className="staff-shift-date">{dayLabel(date)}</th>
      {closed
        ? <td colSpan={9} className="staff-shift-closed">{cell("note", "Note")}</td>
        : <>
          {people.map((field) => <td key={field} className={field.startsWith("s1") ? "staff-shift-s1" : "staff-shift-s2"}>{cell(field, `S${field[1]} Person ${field[3]}`)}</td>)}
          <td>{cell("note", "Note")}</td>
        </>}
      <td className="staff-cell-status"><SaveStatus {...autosave} onRetry={autosave.retry} onUseMine={() => autosave.resolveConflict(true)} onUseLatest={() => autosave.resolveConflict(false)} /></td>
    </tr>
  );
}

// The Super Admin sets the semester period and shift times (also editable in the workbook's Settings tab).
function ScheduleSetup({ workspace, busy, act }) {
  const initial = () => ({ start: workspace.schedule?.start || "", end: workspace.schedule?.end || "", shift1Time: (workspace.shiftTimes || DEFAULT_SHIFT_TIMES).first, shift2Time: (workspace.shiftTimes || DEFAULT_SHIFT_TIMES).second });
  const [form, setForm] = useState(initial);
  return (
    <details className="staff-disclosure staff-schedule-setup">
      <summary>Semester setup</summary>
      <form className="staff-form staff-form-grid" onSubmit={async (event) => { event.preventDefault(); if (!busy) await act("schedule/setup", form); }}>
        <label>First day<input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
        <label>Last day<input type="date" min={form.start || undefined} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
        <label>S1 time<input maxLength={40} placeholder="10:00–13:00" value={form.shift1Time} onChange={(e) => setForm({ ...form, shift1Time: e.target.value })} /></label>
        <label>S2 time<input maxLength={40} placeholder="12:00–15:00" value={form.shift2Time} onChange={(e) => setForm({ ...form, shift2Time: e.target.value })} /></label>
        <div className="button-row staff-field-wide"><button className="primary" disabled={busy}>{busy ? "Saving…" : "Save semester setup"}</button><button type="button" onClick={() => setForm(initial())}>Reset</button></div>
        <p className="staff-muted staff-field-wide">Stored in the workbook's Settings tab. Tutor names are managed on the <Link to="/staff/tutor-list">Tutors</Link> page.</p>
      </form>
    </details>
  );
}

// Super Admin: the semester's tutor list (Tutors tab in the workbook).
export function TutorListPage() {
  const { session } = useOutletContext();
  const { workspace, error, busy, act } = useWorkspace();
  const [draft, setDraft] = useState(null);
  if (session.role !== "admin") return <div className="staff-page"><h1>Tutors</h1><p>Only the Super Admin can manage the tutor list.</p></div>;
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
      <p className="staff-muted">This semester's tutors. They are suggested in the Schedule and listed in Statistics, and stored in the workbook's Tutors tab.</p>
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
    </div>
  );
}

const ACTIVITY_TYPES = ["Shift Update", "Student Update", "Content Update", "Check-in", "Handover", "Other"];
// Super Admin: everything that changed, newest first, with who did it.
export function ChangeLogPage() {
  const { session } = useOutletContext();
  const [log, setLog] = useState(null), [error, setError] = useState(""), [type, setType] = useState(""), [query, setQuery] = useState("");
  useEffect(() => {
    if (session.role !== "admin") return undefined;
    let active = true;
    staffRequest("activity").then((result) => { if (active) setLog(result.entries); }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [session.role]);
  if (session.role !== "admin") return <div className="staff-page"><h1>Change log</h1><p>Only the Super Admin can see the change log.</p></div>;
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
        <table aria-label="Change log">
          <thead><tr><th>When</th><th>Who</th><th>Type</th><th>Student</th><th>Change</th></tr></thead>
          <tbody>{entries.map((entry) => <tr key={entry.id}><td>{staffDateTime(entry.timestamp)}</td><td>{entry.actor}</td><td>{entry.type}</td><td>{entry.studentName || "—"}</td><td>{entry.note}</td></tr>)}</tbody>
        </table>
      </div>}
      <p className="staff-muted">The latest 500 changes. The full history stays in the workbook's Activity tab.</p>
    </div>
  );
}

export function ShiftPage() {
  const { session } = useOutletContext();
  const { workspace, error, busy, act, autosave } = useWorkspace();
  const [extraWeeks, setExtraWeeks] = useState(0);
  if (!workspace) return <State error={error} />;
  const times = workspace.shiftTimes || DEFAULT_SHIFT_TIMES;
  const days = new Map(workspace.data.shifts.map((day) => [day.date, day]));
  const saved = [...days.keys()].sort();
  // The semester period from the workbook decides which days are shown; otherwise show around today.
  const period = workspace.schedule || {};
  const monday = addDays(workspace.today, -((weekday(workspace.today) + 6) % 7));
  const lastSaved = saved.at(-1) || "";
  const first = period.start || (saved[0] && saved[0] < monday ? saved[0] : monday);
  const last = period.end || addDays(lastSaved > addDays(first, 13) ? lastSaved : addDays(first, 13), extraWeeks * 7);
  const dates = [];
  // Cap at a year so a mistyped date can't render thousands of rows.
  for (let date = first; date <= last && dates.length < 366; date = addDays(date, 1)) dates.push(date);
  const tutorNames = (workspace.tutors || []).filter(Boolean);
  const names = [...new Set([...tutorNames, ...(tutorNames.length ? [] : workspace.data.programTutors.map((tutor) => tutor.tutor))].filter((name) => name && name !== "?"))];
  return (
    <div className="staff-page staff-schedule-page">
      <header className="staff-page-heading"><h1>Schedule</h1></header>
      {error && <p role="alert">{error}</p>}
      {!workspace.unified ? <p>The shift schedule needs the Welcome Lounge workbook.</p> : <>
        {session.role === "admin" && <ScheduleSetup key={workspace.etag} workspace={workspace} busy={busy} act={act} />}
        <p className="staff-muted">{period.start && period.end ? `${period.start} to ${period.end}. ` : ""}Type a name in any cell; changes save automatically. For a closed day, clear the names and write the reason in Note.</p>
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
              {dates.map((date) => <ShiftDayRow key={date} date={date} day={days.get(date)} save={(patch, base) => autosave("shifts/day", date, patch, base)} />)}
            </tbody>
          </table>
        </div>
        {!period.end && <button type="button" onClick={() => setExtraWeeks((weeks) => weeks + 1)}>Show one more week</button>}
      </>}
    </div>
  );
}
export function StatisticsPage() {
  const { session } = useOutletContext();
  const { workspace, error } = useWorkspace();
  if (session.role !== "admin") return <div className="staff-page"><h1>Statistics</h1><p>Only the Super Admin can see statistics.</p></div>;
  if (!workspace) return <State error={error} />;
  const shiftTimes = workspace.shiftTimes || DEFAULT_SHIFT_TIMES;
  const rows = tutorStatistics({ shifts: workspace.data.shifts, shiftTimes, tutors: workspace.tutors, schedule: workspace.schedule, today: workspace.today });
  const max = Math.max(1, ...rows.map((row) => row.total));
  const totals = rows.reduce((sum, row) => ({ done: sum.done + row.done, planned: sum.planned + row.planned }), { done: 0, planned: 0 });
  const unreadable = [shiftTimes.first, shiftTimes.second].filter((range) => shiftHours(range) === null);
  const period = workspace.schedule?.start && workspace.schedule?.end ? `${workspace.schedule.start} to ${workspace.schedule.end}` : "all scheduled days";
  return (
    <div className="staff-page staff-statistics-page">
      <header className="staff-page-heading"><h1>Statistics</h1></header>
      <p className="staff-muted">Hours per tutor for {period}. S1 counts as {formatHours(shiftHours(shiftTimes.first) ?? 0)} ({shiftTimes.first}), S2 as {formatHours(shiftHours(shiftTimes.second) ?? 0)} ({shiftTimes.second}).</p>
      {unreadable.length > 0 && <p role="alert">Shift time “{unreadable.join("”, “")}” can’t be read as hours. Use a format like 10:00–13:00 in Semester setup.</p>}
      <div className="staff-stat-tiles">
        <div><strong>{formatHours(totals.done)}</strong><span>worked so far</span></div>
        <div><strong>{formatHours(totals.planned)}</strong><span>still planned</span></div>
        <div><strong>{rows.filter((row) => row.total > 0).length}</strong><span>tutors with shifts</span></div>
      </div>
      {rows.length === 0 ? <p className="staff-empty-state">No tutors or shifts yet. Add tutor names on the Tutors page.</p> : <>
        <section className="staff-panel staff-hours-chart" aria-labelledby="hours-chart-heading">
          <div className="staff-section-header">
            <h2 id="hours-chart-heading">Hours per tutor</h2>
            <p className="staff-chart-legend"><span className="is-done" aria-hidden="true" />Worked <span className="is-planned" aria-hidden="true" />Planned</p>
          </div>
          <ul>
            {rows.map((row) => (
              <li key={row.name} title={`${row.name}: ${formatHours(row.done)} worked, ${formatHours(row.planned)} planned (S1 ${row.first}×, S2 ${row.second}×)`}>
                <span className="staff-bar-label">{row.name}</span>
                <span className="staff-bar-track" aria-hidden="true">
                  {row.done > 0 && <span className="staff-bar is-done" style={{ width: `${(row.done / max) * 100}%` }} />}
                  {row.planned > 0 && <span className="staff-bar is-planned" style={{ width: `${(row.planned / max) * 100}%` }} />}
                </span>
                <span className="staff-bar-value">{formatHours(row.total)}</span>
              </li>
            ))}
          </ul>
        </section>
        <div className="table-scroll">
          <table aria-label="Hours per tutor">
            <thead><tr><th>Tutor</th><th>S1 shifts</th><th>S2 shifts</th><th>Worked</th><th>Planned</th><th>Total</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.name}><td>{row.name}</td><td>{row.first}</td><td>{row.second}</td><td>{formatHours(row.done)}</td><td>{formatHours(row.planned)}</td><td><strong>{formatHours(row.total)}</strong></td></tr>)}</tbody>
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
