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
  const { content, officialSources } = useOutletContext();
  const portalTitles = content["useful-links"].data.links
    .map((link) => link.title)
    .filter(Boolean)
    .slice(0, 3);
  const laterTopics = content["after-arrival"].data.topics.filter((topic) => topic.isActive);
  const links = [
    {
      label: "University portals",
      detail: portalTitles.length ? portalTitles.join(" · ") : "Moodle, BISON and webmail",
      to: "/useful-links",
    },
    {
      label: "Health insurance contacts",
      detail: "Provider contacts and information",
      to: "/health-insurance",
    },
    {
      label: "Rundfunkbeitrag",
      detail: "Living in Germany",
      to: "/rundfunk",
    },
    {
      label: "After-arrival information",
      detail: laterTopics.length
        ? laterTopics.slice(0, 3).map((topic) => topic.title).join(" · ")
        : "Later-stage topics",
      to: "/after-arrival",
    },
  ];
  return (
    <section className="info-page">
      <h1>Useful information</h1>
      <nav aria-label="Useful information">
        {links.map((item) => (
          <Link className="info-link" key={item.to} to={item.to}>
            <span className="info-link-copy">
              <span>{item.label}</span>
              <small>{item.detail}</small>
            </span>
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

function eventDatePart(value, options) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    ...options,
    timeZone: "Europe/Berlin",
  }).format(new Date(`${value}T12:00:00Z`));
}

function EventDate({ event }) {
  const endDate = event.endDate && event.endDate !== event.date ? event.endDate : "";
  return (
    <time className="event-date" dateTime={event.date}>
      <span className="event-date-day">{eventDatePart(event.date, { day: "2-digit" })}</span>
      <span className="event-date-month">{eventDatePart(event.date, { month: "short" })}</span>
      {endDate && (
        <span className="event-date-end">
          to {eventDatePart(endDate, { day: "numeric", month: "short" })}
        </span>
      )}
    </time>
  );
}

function EventEntry({ event, needsReview = false }) {
  const times = event.startTime
    ? event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime
    : "";
  const metadata = [times, event.location, event.language].filter(Boolean).join(" · ");
  const detailUrl = event.detailUrl || event.externalLink;
  return (
    <article className={`event-row${event.date ? "" : " is-undated"}`}>
      {event.date && <EventDate event={event} />}
      <div className="event-content">
        <h2>{event.title}</h2>
        {needsReview ? (
          <p className="event-review-note">Details are being checked. See the official programme.</p>
        ) : (
          metadata && <p className="event-meta">{metadata}</p>
        )}
        {event.descriptionSnippet && <p className="event-description">{event.descriptionSnippet}</p>}
        <div className="event-links">
          {event.registrationUrl && (
            <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer">
              Register ↗
            </a>
          )}
          {detailUrl && (
            <a href={detailUrl} target="_blank" rel="noopener noreferrer">
              {event.registrationUrl ? "Details ↗" : "Event details ↗"}
            </a>
          )}
        </div>
      </div>
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
    (event) => (!event.date || event.sourceStatus === "needs-review") &&
      (!event.date || (event.endDate || event.date) >= today),
  );
  const upcoming = events.filter(
    (event) => !event.isDemo && event.isActive !== false && event.date >= today,
  );
  const officialIds = new Set(verified.map((event) => `${event.title.toLowerCase()}|${event.date}`));
  const published = [
    ...verified.map((event) => ({ event, needsReview: false })),
    ...upcoming
      .filter((event) => !officialIds.has(`${event.title.toLowerCase()}|${event.date}`))
      .map((event) => ({ event, needsReview: false })),
  ].sort((a, b) => a.event.date.localeCompare(b.event.date) || (a.event.startTime || "").localeCompare(b.event.startTime || ""));
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
      {published.map(({ event, needsReview }) => (
        <EventEntry key={event.id} event={event} needsReview={needsReview} />
      ))}
      {ambiguous.length > 0 && (
        <section className="ambiguous-events" aria-label="Events to confirm">
          {ambiguous.map((event) => (
            <EventEntry key={event.id} event={event} needsReview />
          ))}
        </section>
      )}
      {!published.length && !ambiguous.length && (
        <p className="events-empty">No upcoming events published yet.</p>
      )}
      <OfficialSourceLink
        sources={officialSources}
        sourceId="welcomeEvents"
        label="Official Welcome Events programme"
        compact
      />
    </section>
  );
}

export function HelpPage() {
  const { content } = useOutletContext();
  return (
    <section className="help-page">
      <h1>Help</h1>
      <p>
        For common arrival questions, see the <Link to="/journey">Journey</Link> or{" "}
        <Link to="/info">Useful information</Link>. For individual or unusual questions,
        contact the Welcome Lounge.
      </p>
      <EscalationCard config={content.config.data} heading="Welcome Lounge support" />
      <section className="privacy-section">
        <h2>Privacy</h2>
        <p>
          No account is needed; progress stays in this browser. Requests pass through
          the app host and university file service. Feedback is not stored.
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
