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

function formatEventDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(`${date}T12:00:00Z`));
}

function confirmedUpcoming(events) {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
  }).format(new Date());
  return events.find((event) => !event.isDemo && event.date >= today);
}

function StudentHero({ topics, progress }) {
  const activeTopics = topics.filter((topic) => topic.isActive);
  const nextTopic = activeTopics.find(
    (topic) => !progress.completed.includes(topic.id),
  );
  return (
    <section className="student-hero" aria-labelledby="journey-title">
      <div className="hero-copy">
        <p className="eyebrow hero-eyebrow">Welcome to Weimar</p>
        <h1 id="journey-title">Your first weeks, made a little easier.</h1>
        <p>
          Let’s get the important things sorted. Find clear next steps, useful
          information and answers when you need them.
        </p>
      </div>
      <div className="hero-progress">
        <JourneyProgress topics={activeTopics} progress={progress} />
        {nextTopic ? (
          <div className="next-step-panel">
            <span className="eyebrow">Next for you</span>
            <span className="next-step-number">
              {String(activeTopics.indexOf(nextTopic) + 1).padStart(2, "0")}
            </span>
            <h2>{nextTopic.title}</h2>
            <Link className="button-link" to={`/journey/${nextTopic.id}`}>
              Continue journey <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : activeTopics.length ? (
          <div className="next-step-panel journey-finished">
            <span className="eyebrow">All steps complete</span>
            <h2>You’ve sorted your essential first steps.</h2>
            <div className="finish-links">
              <Link to="/events">See events</Link>
              <Link to="/after-arrival">Explore Weimar</Link>
              <Link to="/help">Get help</Link>
            </div>
          </div>
        ) : (
          <div className="next-step-panel">
            <span className="eyebrow">Your journey</span>
            <h2>New steps will appear here.</h2>
          </div>
        )}
      </div>
      <span className="hero-geometry" aria-hidden="true" />
    </section>
  );
}

function TodayOverview({ nextTopic, event }) {
  if (!nextTopic && !event) return null;
  return (
    <section className="today-overview" aria-labelledby="today-title">
      <p className="eyebrow" id="today-title">
        A little for today
      </p>
      <div className="today-items">
        {nextTopic && (
          <Link
            className="today-item today-next"
            to={`/journey/${nextTopic.id}`}
          >
            <span className="today-symbol" aria-hidden="true">
              ○
            </span>
            <span>
              <span className="today-label">Your next step</span>
              <strong>{nextTopic.title}</strong>
            </span>
            <span className="today-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        )}
        {event && (
          <Link className="today-item today-event" to="/events">
            <span className="today-symbol" aria-hidden="true">
              ■
            </span>
            <span>
              <span className="today-label">
                Coming up · {formatEventDate(event.date)}
              </span>
              <strong>{event.title}</strong>
              <span className="today-detail">
                {event.startTime} · {event.location}
              </span>
            </span>
            <span className="today-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        )}
      </div>
    </section>
  );
}

function ExploreSection() {
  return (
    <section className="explore-section" aria-labelledby="explore-title">
      <div>
        <p className="eyebrow">While you’re here</p>
        <h2 id="explore-title">Make yourself at home.</h2>
        <p>Useful places to explore when you’re ready for what comes next.</p>
      </div>
      <nav className="explore-links" aria-label="Explore useful information">
        <Link to="/useful-links">
          <span className="explore-shape square" aria-hidden="true" />
          <span>
            <strong>University portals</strong>
            <small>Moodle, BISON and more</small>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
        <Link to="/after-arrival">
          <span className="explore-shape circle" aria-hidden="true" />
          <span>
            <strong>Settling into Weimar</strong>
            <small>Information for life and study</small>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
        <Link to="/events">
          <span className="explore-shape triangle" aria-hidden="true">
            ▲
          </span>
          <span>
            <strong>Meet people</strong>
            <small>Welcome events and activities</small>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      </nav>
    </section>
  );
}

export function JourneyPage() {
  const { content, progress } = useOutletContext();
  const topics = content.onboarding.data.topics;
  const activeTopics = topics.filter((topic) => topic.isActive);
  const nextTopic = activeTopics.find(
    (topic) => !progress.completed.includes(topic.id),
  );
  const event = confirmedUpcoming(content.events.data.events);
  return (
    <>
      <StudentHero topics={activeTopics} progress={progress} />
      <TodayOverview nextTopic={nextTopic} event={event} />
      <section className="journey-section" aria-labelledby="steps-title">
        <header className="section-heading">
          <div>
            <p className="eyebrow">One step at a time</p>
            <h2 id="steps-title">Your arrival journey</h2>
          </div>
          <p>Open any step whenever it’s useful. There’s no required order.</p>
        </header>
        {activeTopics.length ? (
          <ol className="journey">
            {activeTopics.map((topic, index) => (
              <JourneyStep
                key={topic.id}
                topic={topic}
                index={index}
                completed={progress.completed.includes(topic.id)}
              />
            ))}
          </ol>
        ) : (
          <p className="empty-state">
            No journey steps have been published yet.
          </p>
        )}
      </section>
      <ExploreSection />
      <EscalationCard config={content.config.data} />
    </>
  );
}

function TopicAtAGlance({ topic }) {
  const items = [
    topic.requiredItems.length && {
      label: "What you need",
      value: `${topic.requiredItems.length} ${topic.requiredItems.length === 1 ? "item" : "items"}`,
    },
    topic.documents.length && {
      label: "Documents",
      value: `${topic.documents.length} ${topic.documents.length === 1 ? "download" : "downloads"}`,
    },
    topic.actions.length && {
      label: "Next steps",
      value: `${topic.actions.length} ${topic.actions.length === 1 ? "action" : "actions"}`,
    },
  ].filter(Boolean);
  if (!items.length) return null;
  return (
    <section className="at-a-glance" aria-label="At a glance">
      <p className="eyebrow">At a glance</p>
      <dl>
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
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
  return (
    <article className="topic">
      <Link className="back-link" to={later ? "/after-arrival" : "/journey"}>
        ← {later ? "Explore" : "Your journey"}
      </Link>
      <header className="topic-hero">
        <p className="eyebrow">
          {later ? "Settling in" : `Step ${topic.order} · ${topic.eyebrow}`}
        </p>
        <h1>{topic.title}</h1>
        <p>{topic.summary}</p>
      </header>
      {topic.isDemo && <DemoNotice />}
      <div className="topic-body">
        <section className="topic-intro">
          <h2>{topic.source ? "What this is about" : "About this topic"}</h2>
          <p className="source-text">{topic.description}</p>
        </section>
        <TopicAtAGlance topic={topic} />
        {topic.why && (
          <section className="why-section">
            <h2>Why this matters</h2>
            <p>{topic.why}</p>
          </section>
        )}
        {(!topic.source || topic.actions.length > 0) && (
          <ActionList actions={topic.actions} />
        )}
        {(topic.requiredItems.length > 0 || topic.requiredDocumentsText) && (
          <section className="needs-section">
            <h2>What you need</h2>
            {topic.requiredDocumentsText && (
              <p className="source-text">{topic.requiredDocumentsText}</p>
            )}
            {topic.requiredItems.length > 0 && (
              <ul>
                {topic.requiredItems.map((item, i) => (
                  <li key={i} className="source-text">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        <DocumentList
          key={`documents-${topic.id}`}
          documents={topic.documents}
        />
        {topic.importantNotes.length > 0 && (
          <section className="notice">
            <h2>Keep in mind</h2>
            <ul>
              {topic.importantNotes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </section>
        )}
        <FAQAccordion key={`faqs-${topic.id}`} faqs={topic.faqs} />
        {!later && (
          <section className="completion-area">
            <button
              className="primary"
              aria-pressed={completed}
              onClick={() => progress.toggle(topic.id)}
            >
              {completed
                ? "✓ Done · mark as not done"
                : "Mark this step as done"}
            </button>
            <p role="status" aria-live="polite">
              {completed
                ? `✓ Nice — another step sorted. ${completedCount} of ${topics.length} steps completed.`
                : "Your progress is saved only in this browser. No account needed."}
            </p>
            {!progress.available && (
              <p role="status">
                Your browser cannot save progress; it may be lost when you leave
                this page.
              </p>
            )}
          </section>
        )}
      </div>
      <EscalationCard config={content.config.data} />
      <FeedbackPrompt key={`feedback-${topic.id}`} topicId={topic.id} />
    </article>
  );
}

export function AfterArrivalPage() {
  const { content } = useOutletContext();
  const topics = content["after-arrival"].data.topics;
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">While you’re here</p>
        <h1>Make yourself at home.</h1>
        <p>
          Information for studying and living in Weimar after your first weeks.
        </p>
      </header>
      <div className="card-grid">
        {topics.map((topic) => (
          <Link
            className="card"
            key={topic.id}
            to={`/after-arrival/${topic.id}`}
          >
            <span className="eyebrow">Useful information</span>
            <h2>{topic.title}</h2>
            <p>{topic.summary}</p>
            {topic.isDemo && (
              <small>Sample content · not official guidance</small>
            )}
            <span className="card-link">Explore topic →</span>
          </Link>
        ))}
      </div>
      {!topics.length && <p>No later-stage topics published yet.</p>}
    </>
  );
}

function EventCard({ event }) {
  return (
    <article className={`card event-card${event.isDemo ? " is-sample" : ""}`}>
      {event.isDemo && (
        <p className="eyebrow">Sample only · Not a real event</p>
      )}
      <time dateTime={event.date}>
        {new Intl.DateTimeFormat("en-GB", {
          dateStyle: "full",
          timeZone: "Europe/Berlin",
        }).format(new Date(`${event.date}T12:00:00Z`))}
      </time>
      <h2>{event.title}</h2>
      <p>
        {event.startTime}–{event.endTime} · Weimar local time
      </p>
      <p>
        <strong>Location:</strong> {event.location}
      </p>
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
    <>
      <header className="page-heading">
        <p className="eyebrow">Meet · Connect · Explore</p>
        <h1>Welcome events</h1>
        <p>Find opportunities to meet other students and get to know Weimar.</p>
      </header>
      {upcoming.length ? (
        upcoming.map((event) => <EventCard key={event.id} event={event} />)
      ) : (
        <p className="event-empty">
          No upcoming confirmed events have been published yet. Check back soon.
        </p>
      )}
      {samples.length > 0 && (
        <section className="sample-events">
          <h2>Events preview</h2>
          <p>These examples are for layout preview only.</p>
          {samples.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </section>
      )}
    </>
  );
}

export function HelpPage() {
  const { content } = useOutletContext();
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Need a human?</p>
        <h1>You don’t have to figure it all out alone.</h1>
        <p>Open a journey topic for its questions, documents and next steps.</p>
      </header>
      <EscalationCard config={content.config.data} />
      <section className="privacy-section">
        <h2>Your privacy</h2>
        <p>
          You do not need a student account. Completed steps stay in this
          browser’s local storage and are never sent to our server. You can
          reset them from the journey page or clear your browser data.
        </p>
        <p>
          Page and document requests pass through our hosting provider and the
          university file service. No analytics or personal progress tracking
          has been added. Feedback collection is not connected yet.
        </p>
        <p>External links open services with their own privacy practices.</p>
      </section>
    </>
  );
}

export function FeedbackPage() {
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Help us improve</p>
        <h1>Was this useful?</h1>
        <p>
          We want to understand whether you can find the answers you need.
          Anonymous feedback collection is still being prepared.
        </p>
      </header>
      <FeedbackPrompt />
    </>
  );
}

export function NotFound() {
  return (
    <section className="not-found">
      <span className="not-found-mark" aria-hidden="true">
        ?
      </span>
      <p className="eyebrow">Wrong turn</p>
      <h1>We can’t find that page.</h1>
      <p>This page may have moved or is not available.</p>
      <Link className="button-link" to="/journey">
        Back to your journey →
      </Link>
    </section>
  );
}
