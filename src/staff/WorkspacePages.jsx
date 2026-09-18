import { useState } from "react";
import { Link, useParams, useOutletContext } from "react-router-dom";
import { useWorkspace } from "./useWorkspace";
import { AUTOSAVE_TOGGLE_DELAY, useAutosave } from "./useAutosave";
import { SaveStatus } from "./SaveStatus";
const status = (value) =>
  value === true ? "Yes" : value === false ? "No" : "Unknown";
function State({ error }) {
  return error ? (
    <p role="alert">{error}</p>
  ) : (
    <p role="status">Loading staff records…</p>
  );
}
function StudentTable({ students }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Matriculation no.</th>
            <th>Study program</th>
            <th>Enrolled</th>
            <th>Backpack</th>
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
              <td>{s.matriculationNumber || "Unknown"}</td>
              <td>{s.studyProgram}</td>
              <td>{status(s.enrolled)}</td>
              <td>{status(s.receivedBackpack)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!students.length && <p>No matching students.</p>}
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
  ) : <p>No visitors checked in yet.</p>;
}

function AttentionList({ students }) {
  return students.length ? (
    <ul className="staff-attention-list">
      {students.map((student) => {
        const issues = [];
        if (student.enrolled !== true) issues.push("Enrollment not confirmed");
        if (student.receivedBackpack !== true) issues.push("Backpack not confirmed");
        return (
          <li key={student.id}>
            <Link to={`/staff/students/${student.id}`}>
              {student.name || "Name not supplied"}
            </Link>
            <small>{issues.join(" · ")}</small>
          </li>
        );
      })}
    </ul>
  ) : <p>No student records need follow-up.</p>;
}

export function Dashboard() {
  const { workspace, error } = useWorkspace();
  if (!workspace) return <State error={error} />;
  const { data, today } = workspace;
  const shifts = data.shifts.filter((s) => s.date === today);
  const checkinsToday = data.checkins.filter((checkin) => checkin.date === today);
  const attentionStudents = data.students
    .filter((student) => student.enrolled !== true || student.receivedBackpack !== true)
    .slice(0, 20);
  const dayLabel = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeZone: "Europe/Berlin",
  }).format(new Date(`${today}T12:00:00Z`));
  return (
    <div className="staff-page staff-dashboard">
      <header className="staff-page-heading staff-dashboard-heading">
        <p className="staff-eyebrow">TODAY · {data.semesterLabel || "SEMESTER NOT SET"}</p>
        <h1>Welcome Lounge</h1>
        <p className="staff-page-lead">{dayLabel}</p>
      </header>
      <p className="staff-checkin-count">
        <strong>{checkinsToday.length}</strong> students checked in today
      </p>
      <nav className="staff-quick-actions" aria-label="Today’s actions">
        <Link to="/staff/students">Find a student <span aria-hidden="true">→</span></Link>
        <Link to="/staff/students">Check in a visitor <span aria-hidden="true">→</span></Link>
        <Link to="/staff/handover">Add handover <span aria-hidden="true">→</span></Link>
      </nav>
      <div className="staff-dashboard-grid">
        <section className="staff-dashboard-section" aria-labelledby="today-shifts-heading">
          <h2 id="today-shifts-heading">Today’s shifts</h2>
          <Shifts shifts={shifts} />
        </section>
        <section className="staff-dashboard-section" aria-labelledby="today-checkins-heading">
          <h2 id="today-checkins-heading">Checked in today</h2>
          <TodayCheckins checkins={checkinsToday} students={data.students} />
        </section>
        <section className="staff-dashboard-section staff-dashboard-attention" aria-labelledby="attention-heading">
          <h2 id="attention-heading">Needs attention</h2>
          <AttentionList students={attentionStudents} />
        </section>
        <section className="staff-dashboard-section" aria-labelledby="handover-heading">
          <h2 id="handover-heading">Latest handover</h2>
          <HandoverEntries entries={data.handover} today={today} limit={5} />
        </section>
      </div>
    </div>
  );
}
export function Students() {
  const { workspace, error, act } = useWorkspace();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [newStudent, setNewStudent] = useState({ name: "", matriculationNumber: "", country: "", studyProgram: "" });
  if (!workspace) return <State error={error} />;
  const students = workspace.data.students.filter(
    (s) =>
      `${s.name} ${s.matriculationNumber}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "enrollment"
          ? s.enrolled !== true
          : s.receivedBackpack !== true)),
  );
  return (
    <>
      <h1>Students</h1>
      <div className="staff-form">
        <label>
          Search name or matriculation number
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          Show
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All students</option>
            <option value="enrollment">Enrollment incomplete or unknown</option>
            <option value="backpack">Backpack not received or unknown</option>
          </select>
        </label>
      </div>
      {workspace.unified && <details className="staff-dashboard-section">
        <summary>Add student record</summary>
        <form className="staff-form" onSubmit={async (event) => {
          event.preventDefault();
          if (await act("students/create", newStudent)) setNewStudent({ name: "", matriculationNumber: "", country: "", studyProgram: "" });
        }}>
          <label>Full name<input required maxLength={200} value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} /></label>
          <label>Matriculation number<input inputMode="numeric" maxLength={100} value={newStudent.matriculationNumber} onChange={(e) => setNewStudent({ ...newStudent, matriculationNumber: e.target.value })} /></label>
          <label>Country<input maxLength={200} value={newStudent.country} onChange={(e) => setNewStudent({ ...newStudent, country: e.target.value })} /></label>
          <label>Study programme<input maxLength={300} value={newStudent.studyProgram} onChange={(e) => setNewStudent({ ...newStudent, studyProgram: e.target.value })} /></label>
          <button className="primary">Add student</button>
        </form>
      </details>}
      <StudentTable students={students} />
    </>
  );
}
function StudentEditor({ student, save }) {
  const autosave = useAutosave({
    enrolled: student.enrolled,
    receivedBackpack: student.receivedBackpack,
    accommodation: student.accommodation,
    cityRegistration: student.cityRegistration,
    address: student.address,
    country: student.country,
    studyProgram: student.studyProgram,
    notes: student.notes,
  }, save);
  const { draft, setField } = autosave;
  return (
    <div className="staff-form">
      <div className="staff-autosave-position"><SaveStatus {...autosave} onUseMine={() => autosave.resolveConflict(true)} onUseLatest={() => autosave.resolveConflict(false)} /></div>
      {["enrolled", "receivedBackpack"].map((field) => (
        <label key={field}>
          {field === "enrolled" ? "Enrolled" : "Received backpack"}
          <select
            value={String(draft[field])}
            onChange={(e) => setField(field, e.target.value === "null" ? null : e.target.value === "true", AUTOSAVE_TOGGLE_DELAY)}
          >
            <option value="null">Unknown</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
      ))}
      {[
        ["country", "Country"],
        ["studyProgram", "Study programme"],
        ["accommodation", "Accommodation"],
        ["cityRegistration", "City registration appointment"],
        ["address", "Address"],
        ["notes", "Case notes"],
      ].map(([field, label]) => (
        <label key={field}>
          {label}
          <textarea
            maxLength={field === "notes" ? 4000 : 12000}
            value={draft[field]}
            onChange={(e) => setField(field, e.target.value)}
          />
        </label>
      ))}
      <p>Record only information needed for Welcome Lounge support.</p>
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
      <>
        <h1>Student not found</h1>
        <Link to="/staff/students">Back to students</Link>
      </>
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
    notes: "Case notes",
    address: "Address",
    country: "Country",
    studyProgram: "Study programme",
  };
  return (
    <>
      <Link to="/staff/students">Back to students</Link>
      <h1>{s.name || "Student record"}</h1>
      <p>
        {s.studyProgram} ·{" "}
        {s.matriculationNumber || "Matriculation number unknown"}
      </p>
      <dl>
        <dt>Country</dt>
        <dd>{s.country}</dd>
        <dt>Address</dt>
        <dd className="source-text">{s.address || "Not supplied"}</dd>
        <dt>Imported date</dt>
        <dd>{s.legacyDate || "Unknown"}</dd>
      </dl>
      {error && <p role="alert">{error}</p>}
      <button
        disabled={
          busy ||
          workspace.data.checkins.some(
            (c) => c.studentId === s.id && c.date === workspace.today,
          )
        }
        onClick={() => act("checkin", { id: s.id })}
      >
        Check in today
      </button>
      <StudentEditor
        key={s.id}
        student={s}
        save={(patch, base) => autosave("students/update", s.id, patch, base)}
      />
      {recentUpdates.length > 0 && (
        <section className="staff-record-history" aria-labelledby="student-updates-heading">
          <h2 id="student-updates-heading">Recent updates</h2>
          {recentUpdates.map((entry) => (
            <article className="staff-handover-entry" key={entry.id}>
              <p>{entry.changedFields.map((field) => fieldNames[field] || "Student details").join(" · ")}</p>
              <small>Updated by {entry.actor.name} · {staffDateTime(entry.timestamp)}</small>
            </article>
          ))}
        </section>
      )}
      {recentCheckins.length > 0 && (
        <section className="staff-record-history" aria-labelledby="student-checkins-heading">
          <h2 id="student-checkins-heading">Check-in history</h2>
          {recentCheckins.map((entry) => (
            <article className="staff-handover-entry" key={entry.id}>
              <p>Checked in</p>
              <small>{entry.actor.name} · {staffDateTime(entry.timestamp)}</small>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
function Shifts({ shifts, onEdit }) {
  return shifts.length ? (
    shifts.map((s, i) => (
      <section className="information-section" key={i}>
        <h3>{s.date}</h3>
        <p>{s.start && s.end ? `${s.start}–${s.end}: ` : "Tutors: "}{(s.tutors || [...s.first, ...s.second]).filter(Boolean).join(", ") || "Not assigned"}</p>
        {s.event && <p className="source-text">{s.event}</p>}
        {s.notes && <p className="source-text">{s.notes}</p>}
        {onEdit && <button type="button" onClick={() => onEdit({ id: s.id, date: s.date, start: s.start || "", end: s.end || "", tutor1: (s.tutors || [])[0] || "", tutor2: (s.tutors || [])[1] || "", tutor3: (s.tutors || [])[2] || "", event: s.event || "", notes: s.notes || "" })}>Edit shift</button>}
      </section>
    ))
  ) : (
    <p>No shifts listed.</p>
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
  return <div className="staff-form">
    <div className="staff-autosave-position"><SaveStatus {...autosave} onRetry={autosave.retry} onUseMine={() => autosave.resolveConflict(true)} onUseLatest={() => autosave.resolveConflict(false)} /></div>
    <label>Date<input required type="date" value={autosave.draft.date} onChange={(e) => autosave.setField("date", e.target.value)} /></label>
    <label>Start<input type="time" value={autosave.draft.start} onChange={(e) => autosave.setField("start", e.target.value, AUTOSAVE_TOGGLE_DELAY)} /></label>
    <label>End<input type="time" value={autosave.draft.end} onChange={(e) => autosave.setField("end", e.target.value, AUTOSAVE_TOGGLE_DELAY)} /></label>
    {[0, 1, 2].map((index) => <label key={index}>Tutor {index + 1}<input value={autosave.draft.tutors[index] || ""} onChange={(e) => setTutor(index, e.target.value)} /></label>)}
    <label>Important event<input value={autosave.draft.event} onChange={(e) => autosave.setField("event", e.target.value)} /></label>
    <label>Notes<textarea value={autosave.draft.notes} onChange={(e) => autosave.setField("notes", e.target.value)} /></label>
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
    <>
      <h1>Welcome Lounge shifts</h1>
      <Shifts shifts={workspace.data.shifts} onEdit={workspace.unified && session.role === "admin" ? setShift : null} />
      {workspace.unified && session.role === "admin" && (shift.id ? <details className="staff-dashboard-section" open><summary>Edit shift</summary><ExistingShiftEditor key={shift.id} shift={shift} save={(patch, base) => autosave("shifts/autosave", shift.id, patch, base)} onDone={() => setShift(emptyShift())} /></details> : <details className="staff-dashboard-section" open><summary>Add shift</summary><form className="staff-form" onSubmit={async (event) => { event.preventDefault(); if (await act("shifts/save", { shift })) setShift(emptyShift()); }}>
        <label>Date<input required type="date" value={shift.date} onChange={(e) => setShift({ ...shift, date: e.target.value })} /></label>
        <label>Start<input type="time" value={shift.start} onChange={(e) => setShift({ ...shift, start: e.target.value })} /></label>
        <label>End<input type="time" value={shift.end} onChange={(e) => setShift({ ...shift, end: e.target.value })} /></label>
        {[1, 2, 3].map((n) => <label key={n}>Tutor {n}<input value={shift[`tutor${n}`]} onChange={(e) => setShift({ ...shift, [`tutor${n}`]: e.target.value })} /></label>)}
        <label>Important event<input value={shift.event} onChange={(e) => setShift({ ...shift, event: e.target.value })} /></label>
        <label>Notes<textarea value={shift.notes} onChange={(e) => setShift({ ...shift, notes: e.target.value })} /></label>
        <button className="primary" disabled={busy}>Add shift</button>
      </form></details>)}
    </>
  );
}
export function Tutors() {
  const { workspace, error } = useWorkspace();
  return !workspace ? (
    <State error={error} />
  ) : (
    <>
      <h1>Program tutors</h1>
      {workspace.data.programTutors.map((t, i) => (
        <section key={i} className="information-section">
          <h2>{t.program}</h2>
          <p>{t.tutor === "?" ? "Not assigned" : t.tutor}</p>
          <p>{t.email}</p>
          <p>{t.phone}</p>
          <p>{t.telegram}</p>
        </section>
      ))}
    </>
  );
}
export function Handover() {
  const { workspace, error, busy, act } = useWorkspace();
  const [note, setNote] = useState(""), [studentId, setStudentId] = useState("");
  if (!workspace) return <State error={error} />;
  return (
    <>
      <h1>Shift handover</h1>
      {error && <p role="alert">{error}</p>}
      <form
        className="staff-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act("handover", { note, studentId })) { setNote(""); setStudentId(""); }
        }}
      >
        <label>Student (optional)<select value={studentId} onChange={(e) => setStudentId(e.target.value)}><option value="">No specific student</option>{workspace.data.students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
        <label>
          Note for the next shift
          <textarea
            required
            maxLength={4000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button disabled={busy}>Save handover</button>
      </form>
      {workspace.data.handover
        .slice()
        .reverse()
        .map((n) => (
          <section key={n.id}>
            <p className="source-text">{n.note}</p>
            <small>
              {n.author} · {n.timestamp}
            </small>
          </section>
        ))}
    </>
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
    <>
      <h1>Daily report</h1>
      <label>
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
      <button onClick={download}>Download count summary (CSV)</button>
      <h2>Check-ins</h2>
      {checkins.map((c) => (
        <p key={c.id}>
          {workspace.data.students.find((s) => s.id === c.studentId)?.name ||
            "Student"}{" "}
          · {c.actor.name} · {c.timestamp}
        </p>
      ))}
      <h2>Handover</h2>
      {handover.map((n) => (
        <p key={n.id} className="source-text">
          {n.author}: {n.note}
        </p>
      ))}
    </>
  );
}
