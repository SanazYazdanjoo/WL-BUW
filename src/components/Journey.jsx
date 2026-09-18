import { useState } from "react";
import { whatsappLink } from "../../shared/content";
import { feedbackService } from "../services/feedback";

export function EscalationCard({ config, heading = "Still need help?" }) {
  const link = whatsappLink(config);
  return (
    <section className="escalation">
      <h2>{heading}</h2>
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
