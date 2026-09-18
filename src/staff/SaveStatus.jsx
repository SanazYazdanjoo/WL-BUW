export function SaveStatus({ status, error, onRetry, conflict, onUseMine, onUseLatest }) {
  const labels = { idle: "", dirty: "Changes pending", saving: "Saving…", saved: "✓ Saved", error: "Couldn’t save", conflict: "Changed elsewhere · Review" };
  const fieldNames = { notes: "Case notes", studyProgram: "Study programme", receivedBackpack: "Backpack status", cityRegistration: "City registration", active: "Active", order: "Order", tutors: "Tutor assignments", start: "Start time", end: "End time" };
  return <div className="staff-autosave" aria-live="polite" aria-atomic="true">
    <span>{labels[status] || ""}</span>
    {status === "error" && <button type="button" onClick={onRetry}>Retry</button>}
    {status === "error" && error && <span className="staff-autosave-error">{error}</span>}
    {conflict && <div className="staff-autosave-conflict" role="alert">
      {conflict.fields.map((field) => <p key={field}><strong>{fieldNames[field] || field}</strong> was changed by someone else.<br />Latest saved: “{String(conflict.latest[field] ?? "")}”<br />Your unsaved value: “{String(conflict.mine[field] ?? "")}”</p>)}
      <button type="button" onClick={onUseMine}>Use mine</button> <button type="button" onClick={onUseLatest}>Use latest</button>
    </div>}
  </div>;
}
