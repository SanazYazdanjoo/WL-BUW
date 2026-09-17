import OfficialSourceLink from "../components/OfficialSourceLink";
import JourneyMap from "../components/JourneyMap";
import { findTopic } from "../services/topics";
import { Link, useOutletContext, useParams } from "react-router-dom";
import {
  DemoNotice,
  EscalationCard,
  FeedbackPrompt,
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
      {topics.length ? (
        <JourneyMap topics={topics} completedTopicIds={progress.completed} />
      ) : (
        <p className="empty-state">No journey steps are available yet.</p>
      )}
    </>
  );
}

export function TopicPage({ later = false }) {
  const { topicId } = useParams();
  const { content, progress, officialSources } = useOutletContext();
  const topics = content[later ? "after-arrival" : "onboarding"].data.topics;
  const topic = findTopic(topics, topicId);
  if (!topic) return <NotFound />;

  const completed = progress.completed.includes(topic.id);
  const description = topic.description?.trim() || "";
  const isDemoPlaceholder = topic.isDemo && /^sample content:/i.test(description);
  const summary = topic.summary?.trim() || (isDemoPlaceholder ? "" : description);
  const stepNumber = String(topic.order ?? topics.indexOf(topic) + 1).padStart(2, "0");
  const descriptionStartsWithSummary = summary &&
    description.toLocaleLowerCase().startsWith(summary.toLocaleLowerCase());
  const additionalDescription = isDemoPlaceholder
    ? ""
    : descriptionStartsWithSummary
      ? description.slice(summary.length).replace(/^[\s:.,;—–-]+/, "").trim()
      : description && description !== summary
        ? description
        : "";

  return (
    <article className="topic">
      <Link className="back-link" to={later ? "/info" : "/journey"}>
        {later ? "← Back to useful information" : "← Back to first steps"}
      </Link>
      <header className="topic-heading">
        <div className="topic-heading-main">
          <p className="eyebrow topic-step-label">
            {later ? "Useful information" : `Step ${stepNumber}`}
          </p>
          <div className="topic-title-row">
            <h1>{topic.title}</h1>
            {!later && (
              <button
                className={`topic-completion${completed ? " is-complete" : ""}`}
                aria-label={completed ? "Mark topic incomplete" : "Mark topic complete"}
                aria-pressed={completed}
                onClick={() => progress.toggle(topic.id)}
              >
                {completed ? "✓ Completed" : "Complete"}
              </button>
            )}
          </div>
        </div>
        {summary && <p className="topic-summary">{summary}</p>}
      </header>
      {additionalDescription && (
        <div className="topic-copy">
          {additionalDescription.split(/\n\s*\n/).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      )}
      {!later && (
        <OfficialSourceLink sources={officialSources} topicId={topic.id} compact />
      )}
    </article>
  );
}

export function InfoPage() {
  const { officialSources } = useOutletContext();
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
      <OfficialSourceLink
        sources={officialSources}
        sourceId="preparingStudies"
        label="Preparing your studies"
      />
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

function OfficialEvent({ event, today }) {
  const start = event.date ? new Date(`${event.date}T12:00:00Z`) : null;
  const end = event.endDate ? new Date(`${event.endDate}T12:00:00Z`) : start;
  if (end && end.toISOString().slice(0, 10) < today) return null;
  const dateText = start
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Berlin",
      }).format(start) +
      (event.endDate
        ? `–${new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "Europe/Berlin",
          }).format(end)}`
        : "")
    : "";
  const times = event.startTime
    ? event.endTime
      ? `${event.startTime}–${event.endTime}`
      : event.startTime
    : "";
  return (
    <article className="event-row">
      {dateText && <time dateTime={event.date}>{dateText}</time>}
      <h2>{event.title}</h2>
      {event.sourceStatus === "needs-review" ? (
        <p className="event-review-note">
          Please check the official programme for the current date and time.
        </p>
      ) : (
        <p className="event-meta">
          {[times, event.location, event.language].filter(Boolean).join(" · ")}
        </p>
      )}
      {event.descriptionSnippet && <p>{event.descriptionSnippet}</p>}
      {event.registrationUrl && (
        <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer">
          Register ↗
        </a>
      )}
      <a href={event.detailUrl} target="_blank" rel="noopener noreferrer">
        Official details ↗
      </a>
    </article>
  );
}

export function EventsPage() {
  const { content, officialSources } = useOutletContext();
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
  }).format(new Date());
  const events = content.events.data.events;
  const official = officialSources?.welcomeEvents;
  const publishedOfficial = official?.data?.events || [];
  const verified = publishedOfficial.filter(
    (event) => event.date && event.sourceStatus === "current" && (event.endDate || event.date) >= today,
  ).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  const ambiguous = publishedOfficial.filter(
    (event) => !event.date || event.sourceStatus === "needs-review",
  );
  const upcoming = events.filter(
    (event) => !event.isDemo && event.date >= today,
  );
  const samples = events.filter((event) => event.isDemo);
  return (
    <section className="events-page">
      <h1>Events</h1>
      {official?.status === "stale" && (
        <p className="source-freshness-note">
          We could not verify the latest event information recently. Check the official programme.
        </p>
      )}
      {official?.status === "needs-review" && (
        <p className="source-freshness-note">
          Some event details need checking. Please confirm them in the official programme.
        </p>
      )}
      {verified.map((event) => (
        <OfficialEvent key={event.id} event={event} today={today} />
      ))}
      {ambiguous.length > 0 && (
        <section className="ambiguous-events">
          <h2>Check the official programme</h2>
          {ambiguous.map((event) => (
            <OfficialEvent key={event.id} event={event} today={today} />
          ))}
        </section>
      )}
      {upcoming
        .filter((event) => !publishedOfficial.some((officialEvent) =>
          officialEvent.title.toLowerCase() === event.title.toLowerCase() && officialEvent.date === event.date))
        .map((event) => <EventCard key={event.id} event={event} />)}
      {!verified.length && !ambiguous.length && !upcoming.length && (
        <p>No upcoming events are listed here.</p>
      )}
      {samples.length > 0 && (
        <section className="sample-events">
          <h2>Sample events</h2>
          {samples.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </section>
      )}
      <OfficialSourceLink
        sources={officialSources}
        sourceId="welcomeEvents"
        label="Official Welcome Events programme"
      />
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
