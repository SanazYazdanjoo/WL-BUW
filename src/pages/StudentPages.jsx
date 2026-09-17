import FAQAccordion from "../components/FAQAccordion";
import { findTopic } from "../services/topics";
import { Link, useOutletContext, useParams } from "react-router-dom";
import {
  ActionList,
  DemoNotice,
  DocumentList,
  EscalationCard,
  FeedbackPrompt,
  JourneyProgress,
  JourneyStep,
} from "../components/Journey";

export function JourneyPage() {
  const { content, progress } = useOutletContext();
  const topics = content.onboarding.data.topics.filter(
    (topic) => topic.isActive,
  );
  return (
    <>
      <header className="journey-heading">
        <h1>Your first steps</h1>
      </header>
      <JourneyProgress topics={topics} progress={progress} />
      {topics.some((topic) => topic.isDemo) && (
        <p className="content-note">Sample content · not official guidance.</p>
      )}
      {topics.length ? (
        <ol className="journey" aria-label="Your first steps">
          {topics.map((topic, index) => (
            <JourneyStep
              key={topic.id}
              topic={topic}
              index={index}
              completed={progress.completed.includes(topic.id)}
            />
          ))}
        </ol>
      ) : (
        <p className="empty-state">No journey steps are available yet.</p>
      )}
      <nav className="journey-secondary-links" aria-label="More help">
        <Link to="/events">Events</Link>
        <Link to="/info">Useful information</Link>
        <Link to="/help">Help</Link>
      </nav>
    </>
  );
}

export function TopicPage({ later = false }) {
  const { topicId } = useParams();
  const { content, progress } = useOutletContext();
  const topics = content[later ? "after-arrival" : "onboarding"].data.topics;
  const topic = findTopic(topics, topicId);
  if (!topic) return <NotFound />;

  const completed = progress.completed.includes(topic.id);
  const completedCount = topics.filter((item) =>
    progress.completed.includes(item.id),
  ).length;
  const actionFallback =
    topic.actions.length === 0 && topic.description !== topic.summary
      ? topic.description
      : "";

  return (
    <article className="topic">
      <Link className="back-link" to={later ? "/info" : "/journey"}>
        ← Back to first steps
      </Link>
      <header className="topic-heading">
        <p className="eyebrow">
          {later ? "Useful information" : `Step ${topic.order}`}
        </p>
        <h1>{topic.title}</h1>
        <p>{topic.summary}</p>
      </header>
      {topic.isDemo && <DemoNotice />}
      <div className="topic-content">
        {(topic.actions.length > 0 || actionFallback) && (
          <ActionList actions={topic.actions} fallback={actionFallback} />
        )}
        {(topic.requiredItems.length > 0 || topic.requiredDocumentsText) && (
          <section className="topic-section">
            <h2>What you need</h2>
            {topic.requiredDocumentsText && (
              <p className="source-text">{topic.requiredDocumentsText}</p>
            )}
            {topic.requiredItems.length > 0 && (
              <ul>
                {topic.requiredItems.map((item, index) => (
                  <li className="source-text" key={index}>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {topic.documents.length > 0 && (
          <DocumentList
            key={`documents-${topic.id}`}
            documents={topic.documents}
          />
        )}
        {!topic.isDemo && topic.importantNotes.length > 0 && (
          <section className="topic-section">
            <h2>Important</h2>
            <ul>
              {topic.importantNotes.map((note, index) => (
                <li key={index}>{note}</li>
              ))}
            </ul>
          </section>
        )}
        {topic.faqs.length > 0 && (
          <FAQAccordion key={`faqs-${topic.id}`} faqs={topic.faqs} />
        )}
        {!later && (
          <section className="topic-section completion-section">
            <button
              className="primary"
              aria-pressed={completed}
              onClick={() => progress.toggle(topic.id)}
            >
              {completed ? "Mark as not done" : "Mark as done"}
            </button>
            {completed && (
              <p className="completion-status" role="status" aria-live="polite">
                Done · {completedCount} of {topics.length} completed
              </p>
            )}
            {!progress.available && (
              <p className="completion-status" role="status">
                Progress cannot be saved in this browser.
              </p>
            )}
          </section>
        )}
      </div>
      <EscalationCard config={content.config.data} />
    </article>
  );
}

export function InfoPage() {
  const links = [
    {
      label: "University portals",
      to: "/useful-links",
    },
    {
      label: "Health insurance contacts",
      to: "/health-insurance",
    },
    {
      label: "Rundfunkbeitrag",
      to: "/rundfunk",
    },
    {
      label: "After-arrival information",
      to: "/after-arrival",
    },
  ];
  return (
    <section className="info-page">
      <h1>Useful information</h1>
      <nav aria-label="Useful information">
        {links.map((item) => (
          <Link className="info-link" key={item.to} to={item.to}>
            <span>{item.label}</span>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}

export function AfterArrivalPage() {
  const { content } = useOutletContext();
  const topics = content["after-arrival"].data.topics;
  return (
    <section className="info-page">
      <Link className="back-link" to="/info">
        ← Useful information
      </Link>
      <h1>After arrival</h1>
      {topics.some((topic) => topic.isDemo) && <DemoNotice />}
      <nav aria-label="After-arrival topics">
        {topics.map((topic) => (
          <Link
            className="info-link"
            key={topic.id}
            to={`/after-arrival/${topic.id}`}
          >
            <span>{topic.title}</span>
            <small>{topic.summary}</small>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </nav>
      {!topics.length && <p>No after-arrival information is available yet.</p>}
    </section>
  );
}

function EventCard({ event }) {
  return (
    <article className="event-row">
      {event.isDemo && <p className="eyebrow">Sample · not a real event</p>}
      <time dateTime={event.date}>
        {new Intl.DateTimeFormat("en-GB", {
          dateStyle: "full",
          timeZone: "Europe/Berlin",
        }).format(new Date(`${event.date}T12:00:00Z`))}
        {" · "}
        {event.startTime}–{event.endTime}
      </time>
      <h2>{event.title}</h2>
      <p>{event.location}</p>
      <p>{event.description}</p>
      {event.externalLink && (
        <a href={event.externalLink} target="_blank" rel="noopener noreferrer">
          Event details ↗
        </a>
      )}
    </article>
  );
}

export function EventsPage() {
  const { content } = useOutletContext();
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
  }).format(new Date());
  const events = content.events.data.events;
  const upcoming = events.filter(
    (event) => !event.isDemo && event.date >= today,
  );
  const samples = events.filter((event) => event.isDemo);
  return (
    <section className="events-page">
      <h1>Events</h1>
      {upcoming.length ? (
        upcoming.map((event) => <EventCard key={event.id} event={event} />)
      ) : (
        <p>No upcoming events.</p>
      )}
      {samples.length > 0 && (
        <section className="sample-events">
          <h2>Sample events</h2>
          {samples.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </section>
      )}
    </section>
  );
}

export function HelpPage() {
  const { content } = useOutletContext();
  return (
    <section className="help-page">
      <h1>Help</h1>
      <EscalationCard config={content.config.data} />
      <section className="privacy-section">
        <h2>Privacy</h2>
        <p>
          You do not need an account. Progress stays in this browser and is not
          sent to the server. Page and document requests pass through our host
          and the university file service. Feedback is not stored yet.
        </p>
      </section>
      <Link to="/feedback">Feedback</Link>
    </section>
  );
}

export function FeedbackPage() {
  return (
    <section className="feedback-page">
      <Link className="back-link" to="/help">
        ← Help
      </Link>
      <h1>Feedback</h1>
      <FeedbackPrompt />
    </section>
  );
}

export function NotFound() {
  return (
    <section className="not-found">
      <h1>Page not found</h1>
      <p>This page may have moved or is not available.</p>
      <Link to="/journey">Back to first steps →</Link>
    </section>
  );
}
