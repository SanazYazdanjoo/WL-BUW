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
  const count = topics.filter((topic) =>
    progress.completed.includes(topic.id),
  ).length;
  const percent = topics.length ? Math.round((count / topics.length) * 100) : 0;
  return (
    <section className="progress-panel" aria-label="Your progress">
      <div className="progress-heading">
        <strong aria-live="polite">
          {count} of {topics.length} steps done
        </strong>
        <span aria-hidden="true">{percent}%</span>
      </div>
      <progress
        max={topics.length || 1}
        value={count}
        aria-label={`${count} of ${topics.length} steps completed`}
      />
      <p>Your progress stays in this browser. No account needed.</p>
      {!progress.available && (
        <p role="status">
          Progress can’t be saved by this browser and may be lost when you
          leave.
        </p>
      )}
      {count > 0 && (
        <button className="text-button" onClick={progress.reset}>
          Reset progress
        </button>
      )}
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
          {completed ? "✓" : index + 1}
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
            <h3 id={`${topic.id}-title`}>{topic.title}</h3>
            <p id={`${topic.id}-summary`}>{topic.summary}</p>
          </div>
          <span className="step-meta">
            <span className="card-link">
              {completed ? "Review step" : "Open step"}{" "}
              <span aria-hidden="true">→</span>
            </span>
            {topic.requiredItems.length > 0 && (
              <small>{topic.requiredItems.length} things to prepare</small>
            )}
            {topic.documents.length > 0 && (
              <small>{topic.documents.length} documents</small>
            )}
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
      <p className="eyebrow">
        <span className="help-triangle" aria-hidden="true">
          ▲
        </span>{" "}
        Still stuck?
      </p>
      <h2>Need a human?</h2>
      <p>
        Some situations are easier to solve with a real person. Ask the Welcome
        Lounge tutors.
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
    <section className="action-section">
      <h2>What to do</h2>
      {actions.length ? (
        <ol className="action-list">
          {actions.map((action, index) => (
            <li key={index}>{action}</li>
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
      const anchor = window.document.createElement("a");
      anchor.href = url;
      const extension =
        document.path
          .split("/")
          .at(-1)
          .match(/\.[a-z0-9]{1,8}$/i)?.[0] || "";
      anchor.download = /\.[a-z0-9]{1,8}$/i.test(document.label)
        ? document.label
        : `${document.label || "Download"}${extension}`;
      anchor.click();
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
    <section className="documents-section">
      <h2>Documents</h2>
      {documents.length ? (
        <ul className="document-list">
          {documents.map((document) => (
            <li key={document.path}>
              <button
                className="document-card"
                disabled={Boolean(busy)}
                onClick={() => download(document)}
              >
                <span className="document-symbol" aria-hidden="true">
                  ■
                </span>
                <span className="document-copy">
                  <span className="eyebrow">Document</span>
                  <strong>{document.label}</strong>
                </span>
                <span className="document-download">
                  {busy === document.path ? "Downloading…" : "Download ↘"}
                </span>
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
