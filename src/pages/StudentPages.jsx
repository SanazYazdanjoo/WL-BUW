import OfficialSourceLink from "../components/OfficialSourceLink";
import JourneyMap from "../components/JourneyMap";
import { findTopic } from "../services/topics";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useState } from "react";
import {
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
      {topic.relatedPage && (
        <p className="topic-related-page">
          <Link to={topic.relatedPage}>Open portal links <span aria-hidden="true">→</span></Link>
        </p>
      )}
      {!later && (
        <OfficialSourceLink
          sources={officialSources}
          topicId={topic.id}
          officialUrl={topic.officialSource}
          officialLabel={topic.officialSourceLabel}
          compact
        />
      )}
    </article>
  );
}

export function InfoPage() {
  const { content } = useOutletContext();
  const [query, setQuery] = useState("");
  const laterTopics = content["after-arrival"].data.topics.filter((topic) => topic.isActive);
  const editorialLinks = content["useful-links"].data.links
    .map((item) => ({
      label: item.title,
      detail: item.description,
      searchText: item.category,
      href: item.url,
    }));
  const links = [
    ...editorialLinks,
      ...laterTopics.map((topic) => ({
        label: topic.title,
        detail: topic.summary,
        searchText: topic.shortTitle,
        to: `/after-arrival/${topic.id}`,
      })),
      {
        label: "Community & support",
        detail: "Student initiatives, peer support and housing notices",
        to: "/info/community",
      },
    {
      label: "Rundfunkbeitrag",
      detail: "Living in Germany",
      to: "/rundfunk",
    },
  ];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleLinks = links.filter((item) =>
    `${item.label} ${item.detail} ${item.searchText || ""}`
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );
  return (
    <section className="info-page">
      <h1 className="sr-only">Useful information</h1>
      <label className="info-search">
        <span className="sr-only">Search useful information</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="What information are you looking for?"
        />
      </label>
      <nav aria-label="Useful information">
        {visibleLinks.map((item) => <InfoLink item={item} key={item.id || item.to || item.href || item.label} />)}
      </nav>
      {!visibleLinks.length && <p className="info-no-results">No matching information.</p>}
    </section>
  );
}

function InfoLink({ item }) {
  const content = (
    <>
      <span className="info-link-copy">
        <span>{item.label}</span>
        {item.detail && <small>{item.detail}</small>}
      </span>
      {(item.href || item.to) && <span aria-hidden="true">{item.href ? "↗" : "→"}</span>}
    </>
  );
  return item.href ? (
    <a className="info-link" href={item.href} target="_blank" rel="noopener noreferrer">{content}</a>
  ) : item.to ? (
    <Link className="info-link" to={item.to}>{content}</Link>
  ) : (
    <div className="info-link is-static">{content}</div>
  );
}

export function CommunityPage() {
  const { content, communityFeed } = useOutletContext();
  const community = content.community.data;
  const supportResources = content["support-resources"].data.resources;
  const communityResources = content["community-resources"].data.resources;
  const fromWorkbook = (kind) => ["nextcloud", "stale"].includes(content[kind].source);
  const workbookResourcesPublished = fromWorkbook("support-resources") || fromWorkbook("community-resources");
  const legacyResources = workbookResourcesPublished ? [] : community.resources;
  const legacySharing = !workbookResourcesPublished
    ? community.sharingIsCaring
    : null;
  const noticeDate = (value) => new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", timeZone: "Europe/Berlin",
  }).format(new Date(value));
  return (
    <section className="community-page info-page">
      <Link className="back-link" to="/info">← Info</Link>
      <h1>Community &amp; support</h1>
      <section className="community-section" aria-labelledby="community-notices-title">
        <h2 id="community-notices-title">Housing &amp; community notices</h2>
        {communityFeed === "stale" && <p className="community-feed-note">This list could not be refreshed. Check the university message boards for current notices.</p>}
        {community.notices?.length ? community.notices.map((notice) => (
          <a className="community-notice" key={notice.id} href={notice.url} target="_blank" rel="noopener noreferrer">
            <span className="community-notice-meta">{notice.category} · {noticeDate(notice.date)}</span>
            <span className="community-notice-title">{notice.title}</span>
            {notice.excerpt && <span className="community-notice-excerpt">{notice.excerpt}</span>}
            <span className="community-notice-link">Open notice ↗</span>
          </a>
        )) : communityFeed === "unavailable" ? null : <p>No recent notices are available.</p>}
        <a className="community-board-link" href="https://www.uni-weimar.de/en/university/news/message-boards/" target="_blank" rel="noopener noreferrer">View all University Message Boards ↗</a>
      </section>
      <section className="community-section" aria-labelledby="community-student-title">
        <h2 id="community-student-title">Student initiatives</h2>
        {legacyResources.filter((resource) => resource.category === "Student initiatives" || resource.category === "Student representation").map((resource) => (
          <CommunityResource key={resource.id} resource={resource} />
        ))}
      </section>
      <section className="community-section" aria-labelledby="community-support-title">
        <h2 id="community-support-title">Peer support</h2>
        {supportResources.map((resource) => (
          <SupportResource key={resource.id} resource={resource} />
        ))}
        {legacyResources.filter((resource) => resource.category === "Peer support").map((resource) => (
          <CommunityResource key={resource.id} resource={resource} />
        ))}
      </section>
      {communityResources.length > 0 && (
        <section className="community-section" aria-labelledby="community-links-title">
          <h2 id="community-links-title">Community-run links</h2>
          {communityResources.map((resource) => (
            <a className="community-resource" href={resource.url} target="_blank" rel="noopener noreferrer" key={resource.id}>
              <span><strong>{resource.title}</strong><small>{resource.shortText} · Community-run</small></span>
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </section>
      )}
      {legacySharing && (
        <section className="community-section sharing-section" aria-labelledby="sharing-title">
          <h2 id="sharing-title">{legacySharing.label}</h2>
          {legacySharing.enabled ? (
            <a className="community-resource" href={legacySharing.url} target="_blank" rel="noopener noreferrer">Open Telegram community ↗</a>
          ) : <p>The current Telegram invite has not been published.</p>}
        </section>
      )}
      <p className="community-help">Need individual support? <Link to="/help">Contact the Welcome Lounge tutors →</Link></p>
    </section>
  );
}

function CommunityResource({ resource }) {
  return (
    <a className="community-resource" href={resource.url} target="_blank" rel="noopener noreferrer">
      <span><strong>{resource.title}</strong><small>{resource.description}</small></span>
      <span aria-hidden="true">↗</span>
    </a>
  );
}

function SupportResource({ resource }) {
  const links = [
    ["University information", resource.officialUrl],
    ["Website", resource.websiteUrl],
    ["Telegram", resource.telegramUrl],
    ["Instagram", resource.instagramUrl],
    ["Email", resource.email ? `mailto:${resource.email}` : ""],
  ].filter(([, href]) => href);
  return (
    <div className="community-resource">
      <span><strong>{resource.title}</strong><small>{resource.shortText}</small></span>
      <span className="community-resource-links">
        {links.map(([label, href]) => (
          <a key={label} href={href} target={href.startsWith("mailto:") ? undefined : "_blank"} rel={href.startsWith("mailto:") ? undefined : "noopener noreferrer"}>
            {label}{href.startsWith("mailto:") ? "" : " ↗"}
          </a>
        ))}
      </span>
    </div>
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

function EventEntry({ event }) {
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
        {metadata && <p className="event-meta">{metadata}</p>}
        {(event.descriptionSnippet || event.description) && <p className="event-description">{event.descriptionSnippet || event.description}</p>}
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
  const upcoming = events.filter(
    (event) => !event.isDemo && event.isActive !== false && event.date >= today,
  );
  const officialIds = new Set(verified.map((event) => `${event.title.toLowerCase()}|${event.date}`));
  const published = [
    ...verified,
    ...upcoming
      .filter((event) => !officialIds.has(`${event.title.toLowerCase()}|${event.date}`)),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || "").localeCompare(b.startTime || ""));
  return (
    <section className="events-page">
      <h1>Events</h1>
      {official?.status === "stale" && (
        <p className="source-freshness-note">
          We could not verify the latest event information recently. Check the official programme.
        </p>
      )}
      {published.map((event) => (
        <EventEntry key={event.id} event={event} />
      ))}
      <OfficialSourceLink
        sources={officialSources}
        sourceId="welcomeEvents"
        label="Official Welcome Events programme"
        compact
        showStatusNote={false}
      />
    </section>
  );
}

export function HelpPage() {
  const { content } = useOutletContext();
  const helpLinks = content["useful-links"].data.links.filter((item) => item.category === "Help");
  return (
    <section className="help-page">
      <h1>Help</h1>
      <p>
        For common arrival questions, see the <Link to="/journey">Journey</Link> or{" "}
        <Link to="/info">Useful information</Link>. For individual or unusual questions,
        contact the Welcome Lounge.
      </p>
      <EscalationCard config={content.config.data} heading="Welcome Lounge support" />
      {helpLinks.map((item) => (
        <a className="info-link" key={item.id} href={item.url} target="_blank" rel="noopener noreferrer">
          <span className="info-link-copy"><span>{item.title}</span>{item.description && <small>{item.description}</small>}</span>
          <span aria-hidden="true">↗</span>
        </a>
      ))}
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
