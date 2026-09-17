import { useState } from "react";
import { whatsappLink } from "../../shared/content";
import { feedbackService } from "../services/feedback";

export function DemoNotice() {
  return (
    <p className="content-note">Sample content · not official guidance.</p>
  );
}

export function EscalationCard({ config }) {
  const link = whatsappLink(config);
  return (
    <section className="escalation">
      <h2>Still need help?</h2>
      {link ? (
        <>
          <p>{config.contactLabel || "Welcome Lounge tutors"}</p>
          <a href={link} target="_blank" rel="noopener noreferrer">
            WhatsApp · {config.semesterLabel} ↗
          </a>
        </>
      ) : (
        <p>
          {config.helpText ||
            "The current Welcome Lounge contact link has not been published yet."}
        </p>
      )}
    </section>
  );
}

export function ActionList({ actions, fallback = "" }) {
  return (
    <section className="topic-section">
      <h2>What to do</h2>
      {actions.length > 0 ? (
        <ol className="action-list">
          {actions.map((action, index) => (
            <li key={index}>{action}</li>
          ))}
        </ol>
      ) : (
        <p className="source-text">{fallback || "No actions published yet."}</p>
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
        "Document unavailable. Try again later or ask the Welcome Lounge.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="topic-section">
      <h2>Documents</h2>
      <ul className="document-list">
        {documents.map((document) => (
          <li key={document.path}>
            <button
              className="document-button"
              disabled={Boolean(busy)}
              onClick={() => download(document)}
            >
              <span>
                {busy === document.path
                  ? "Downloading…"
                  : `Download ${document.label}`}
              </span>
              <span aria-hidden="true">↘</span>
            </button>
          </li>
        ))}
      </ul>
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
      <h2>Was this useful?</h2>
      <p>Feedback is not stored yet.</p>
      <div className="button-row">
        <button onClick={() => submit(true)}>Yes</button>
        <button onClick={() => submit(false)}>No</button>
      </div>
      <p role="status">{message}</p>
    </section>
  );
}
