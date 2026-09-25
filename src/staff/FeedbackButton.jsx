import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { staffRequest } from "./service";

const KINDS = [["suggestion", "Suggestion"], ["problem", "Problem / error"], ["other", "Other"]];

// Fixed bottom-right: anyone in the workspace can send a suggestion or report a problem.
// It is saved as a "Feedback" row in the workbook's Activity tab (visible on the Change log page).
export function FeedbackButton({ session }) {
  const location = useLocation();
  const [open, setOpen] = useState(false), [kind, setKind] = useState("suggestion"), [message, setMessage] = useState("");
  const [state, setState] = useState({ busy: false, error: "", sent: false });
  const textRef = useRef(null), buttonRef = useRef(null);
  useEffect(() => { if (open) textRef.current?.focus(); }, [open]);
  function close() {
    setOpen(false);
    setState((current) => ({ ...current, error: "" }));
    buttonRef.current?.focus();
  }
  async function send(event) {
    event.preventDefault();
    if (!message.trim()) { setState({ busy: false, error: "Write a short message first.", sent: false }); return; }
    setState({ busy: true, error: "", sent: false });
    try {
      await staffRequest("feedback/send", { csrf: session.csrf, body: { kind, message, page: location.pathname } });
      setMessage("");
      setState({ busy: false, error: "", sent: true });
    } catch (e) {
      setState({ busy: false, error: e.message, sent: false });
    }
  }
  return (
    <div className="staff-feedback">
      {open && (
        <section className="staff-feedback-panel" role="dialog" aria-labelledby="feedback-title" onKeyDown={(event) => { if (event.key === "Escape") close(); }}>
          <div className="staff-feedback-head">
            <h2 id="feedback-title">Feedback</h2>
            <button type="button" className="staff-feedback-close" aria-label="Close feedback" onClick={close}>×</button>
          </div>
          {state.sent ? (
            <div className="staff-feedback-thanks" role="status">
              <p><strong>Thank you!</strong> Your message was sent to the Welcome Lounge team.</p>
              <button type="button" onClick={() => setState({ busy: false, error: "", sent: false })}>Send another</button>
            </div>
          ) : (
            <form className="staff-form" onSubmit={send}>
              <fieldset className="staff-feedback-kinds">
                <legend>What is it about?</legend>
                {KINDS.map(([value, label]) => (
                  <label key={value} className={kind === value ? "is-selected" : undefined}>
                    <input type="radio" name="feedback-kind" value={value} checked={kind === value} onChange={() => setKind(value)} />{label}
                  </label>
                ))}
              </fieldset>
              <label>Your message<textarea ref={textRef} rows={4} maxLength={2000} value={message} placeholder={kind === "problem" ? "What happened, and what did you expect?" : "Your idea or comment"} onChange={(e) => setMessage(e.target.value)} /></label>
              <p className="staff-muted">Sent with your name and this page ({location.pathname}).</p>
              {state.error && <p role="alert">{state.error}</p>}
              <div className="button-row"><button className="primary" disabled={state.busy}>{state.busy ? "Sending…" : "Send"}</button><button type="button" onClick={close}>Cancel</button></div>
            </form>
          )}
        </section>
      )}
      <button ref={buttonRef} type="button" className="staff-feedback-button" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
        <span aria-hidden="true">✎</span> Feedback
      </button>
    </div>
  );
}
