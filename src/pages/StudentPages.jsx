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
  const topics = content.onboarding.data.topics;
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">
          {content.config.data.semesterLabel} · Your first weeks
        </p>
        <h1>
          Your first steps
          <br />
          in Weimar.
        </h1>
        <p>
          Seven things to explore during your first weeks. Open any step for its
          next actions, documents and answers to common questions. Start
          wherever you need to.
        </p>
      </header>
      <JourneyProgress topics={topics} progress={progress} />
      <h2 className="sr-only">Your arrival journey</h2>
      {topics.length ? (
        <ol className="journey">
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
        <p>No journey steps have been published yet.</p>
      )}
      <EscalationCard config={content.config.data} />
    </>
  );
}
export function TopicPage({ later = false }) {
  const { topicId } = useParams();
  const { content, progress } = useOutletContext();
  const topic = findTopic(
    content[later ? "after-arrival" : "onboarding"].data.topics,
    topicId,
  );
  if (!topic) return <NotFound />;
  const completed = progress.completed.includes(topic.id);
  return (
    <article className="topic">
      <Link to={later ? "/after-arrival" : "/journey"}>
        ← {later ? "After your first weeks" : "Back to your journey"}
      </Link>
      <header className="page-heading">
        <p className="eyebrow">
          {later ? "Settling in" : `Arrival · Step ${topic.order}`}
        </p>
        <h1>{topic.title}</h1>
        <p>{topic.summary}</p>
      </header>
      {topic.isDemo && <DemoNotice />}
      <div className="topic-body">
        <section>
          <h2>About this step</h2>
          <p>{topic.description}</p>
        </section>
        <section>
          <h2>Why this matters</h2>
          <p>{topic.why}</p>
        </section>
        <ActionList actions={topic.actions} />
        <DocumentList key={topic.id} documents={topic.documents} />
        {topic.importantNotes.length > 0 && (
          <section className="notice">
            <h2>Keep in mind</h2>
            <ul>
              {topic.importantNotes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </section>
        )}
        <FAQAccordion key={topic.id} faqs={topic.faqs} />
        {!later && (
          <section>
            <button
              className="primary"
              aria-pressed={completed}
              onClick={() => progress.toggle(topic.id)}
            >
              {completed
                ? "\u2713 Completed — mark as incomplete"
                : "Mark as done"}
            </button>
            <p role="status">
              {completed ? "You marked this step complete. " : ""}
              {progress.available
                ? "Saved only in this browser on this device."
                : "Your browser cannot save progress. It will be lost when you leave."}
            </p>
          </section>
        )}
      </div>
      <EscalationCard config={content.config.data} />
      <FeedbackPrompt key={topic.id} topicId={topic.id} />
    </article>
  );
}
export function AfterArrivalPage() {
  const { content } = useOutletContext();
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Beyond arrival</p>
        <h1>Make yourself at home.</h1>
        <p>
          Information for studying and living in Weimar after your first weeks.
        </p>
      </header>
      <div className="card-grid">
        {content["after-arrival"].data.topics.map((t) => (
          <Link className="card" key={t.id} to={`/after-arrival/${t.id}`}>
            <h2>{t.title}</h2>
            <p>{t.summary}</p>
            {t.isDemo && <small>Sample content</small>}
            <span className="card-link">Explore topic →</span>
          </Link>
        ))}
      </div>
      {!content["after-arrival"].data.topics.length && (
        <p>No later-stage topics published yet.</p>
      )}
    </>
  );
}
function EventCard({ event }) {
  return (
    <article className="card event-card">
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
  const upcoming = events.filter((e) => !e.isDemo && e.date >= today),
    samples = events.filter((e) => e.isDemo);
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Meet · Connect · Explore</p>
        <h1>Welcome events</h1>
        <p>Find opportunities to meet other students and get to know Weimar.</p>
      </header>
      {upcoming.length ? (
        upcoming.map((e) => <EventCard key={e.id} event={e} />)
      ) : (
        <p className="card">
          No upcoming confirmed events have been published.
        </p>
      )}
      {samples.length > 0 && (
        <section>
          <h2>Preview of the events experience</h2>
          {samples.map((e) => (
            <EventCard key={e.id} event={e} />
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
        <h1>You do not have to figure it all out alone.</h1>
        <p>Open a journey topic for its questions, documents and next steps.</p>
      </header>
      <EscalationCard config={content.config.data} />
      <section className="card">
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
        <h1>Help us improve</h1>
        <p>
          We want to understand whether you can find the answers you need.
          Anonymous feedback collection is still being prepared.
        </p>
      </header>
      <FeedbackPrompt />
    </>
  );
}
export function StaffPage() {
  return (
    <section className="card">
      <p className="eyebrow">Staff area · Not enabled</p>
      <h1>Welcome Lounge tutors</h1>
      <p>
        Staff sign-in and operational records are not available in this pilot
        build. No visitor, check-in or handover data is loaded here.
      </p>
      <p>
        Continue using the team’s existing approved process. Secure
        authentication and persistent storage must be agreed before this area is
        enabled.
      </p>
      <Link to="/">Return to student journey</Link>
    </section>
  );
}
export function NotFound() {
  return (
    <section className="card">
      <h1>Page not found</h1>
      <p>This page may have moved or is not available.</p>
      <Link to="/journey">Go to your journey</Link>
    </section>
  );
}
