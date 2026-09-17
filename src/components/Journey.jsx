import { useState } from "react";
import { Link } from "react-router-dom";
import { whatsappLink } from "../../shared/content";
import { feedbackService } from "../services/feedback";
export function DemoNotice() {
  return (
    <p className="notice">
      Sample content · Awaiting International Office review. This is not
      administrative guidance.
    </p>
  );
}
export function JourneyProgress({ topics, progress }) {
  const count = topics.filter((t) => progress.completed.includes(t.id)).length;
  return (
    <section className="progress-panel" aria-label="Your progress">
      <div>
        <strong aria-live="polite">
          {count} of {topics.length} steps completed
        </strong>
        <progress
          max={topics.length || 1}
          value={count}
          aria-label="Completed journey steps"
        />
      </div>
      <p>
        Your progress is stored only on this browser. No account is required.
      </p>
      {!progress.available && (
        <p role="status">
          Your browser cannot save progress. It will last only while this page
          stays open.
        </p>
      )}
      <button className="text-button" onClick={progress.reset}>
        Reset progress
      </button>
    </section>
  );
}
export function JourneyStep({ topic, completed, index }) {
  return (
    <li className={`journey-step${completed ? " is-complete" : ""}`}>
      <Link
        className="journey-row"
        to={`/journey/${topic.id}`}
        aria-labelledby={`${topic.id}-title ${topic.id}-state`}
        aria-describedby={`${topic.id}-summary`}
      >
        <span className="node" aria-hidden="true">
          {completed ? "\u2713" : index + 1}
        </span>
        <div className="step-content">
          <span className="step-context">{topic.eyebrow}</span>
          <span
            id={`${topic.id}-state`}
            className={completed ? "completion-label" : "sr-only"}
          >
            {completed ? "Completed" : `Step ${index + 1} · Not completed`}
          </span>
          <div className="step-description">
            <h2 id={`${topic.id}-title`}>{topic.title}</h2>
            <p id={`${topic.id}-summary`}>{topic.summary}</p>
          </div>
          <span className="step-meta">
            <span className="card-link">
              Open step <span aria-hidden="true">→</span>
            </span>
            {topic.isDemo && <small>Sample content</small>}
          </span>
        </div>
      </Link>
    </li>
  );
}
export function EscalationCard({ config }) {
  const link = whatsappLink(config);
  return (
    <section className="escalation">
      <h2>Still stuck?</h2>
      <p>
        If this page did not answer your question, ask the Welcome Lounge
        tutors.
      </p>
      <p>{config.helpText}</p>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer">
          Join the Welcome Lounge WhatsApp group for {config.semesterLabel} ↗
        </a>
      ) : (
        <p>
          The current Welcome Lounge contact link has not been published yet.
        </p>
      )}
      {link && (
        <small>
          WhatsApp is an external service. Joining may share your phone number
          with group members.
        </small>
      )}
    </section>
  );
}
export function ActionList({ actions }) {
  return (
    <section>
      <h2>What you need to do</h2>
      {actions.length ? (
        <ol className="action-list">
          {actions.map((action, i) => (
            <li key={i}>{action}</li>
          ))}
        </ol>
      ) : (
        <p>No action steps published yet.</p>
      )}
    </section>
  );
}
export function DocumentList({ documents }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  async function download(document) {
    setBusy(document.path);
    setError("");
    try {
      const response = await fetch(
        `/api/nextcloud/download?path=${encodeURIComponent(document.path)}`,
        { signal: AbortSignal.timeout(55000) },
      );
      if (!response.ok) throw new Error("Unavailable");
      const url = URL.createObjectURL(await response.blob());
      const a = window.document.createElement("a");
      a.href = url;
      a.download = document.path.split("/").at(-1);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(
        "This document could not be downloaded. Please try again or ask the Welcome Lounge team.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <section>
      <h2>Documents</h2>
      {documents.length ? (
        <ul className="document-list">
          {documents.map((d) => (
            <li key={d.path}>
              <button disabled={Boolean(busy)} onClick={() => download(d)}>
                {busy === d.path ? "Downloading…" : `Download ${d.label}`}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>No documents published for this topic yet.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function FeedbackPrompt({ topicId, faqId }) {
  const [message, setMessage] = useState("");
  async function submit(answer) {
    try {
      const result = await feedbackService.submit({
        topicId,
        faqId,
        answer,
        timestamp: new Date().toISOString(),
      });
      setMessage(result.message);
    } catch {
      setMessage("Feedback could not be sent. Please try again later.");
    }
  }
  return (
    <section className="feedback">
      <h2>Did this answer your question?</h2>
      <p>Preview only: feedback collection is not connected yet.</p>
      <div className="button-row">
        <button onClick={() => submit(true)}>Yes</button>
        <button onClick={() => submit(false)}>No</button>
      </div>
      <p role="status">{message}</p>
    </section>
  );
}
