import sourcesConfig from "../../content/app-content/sources.json";
import { resolveOfficialLink } from "../services/officialLink";

function checkedLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const today = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date());
  const checked = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Berlin",
  }).format(date);
  return checked === today ? "Checked today" : `Last checked ${checked}`;
}

export default function OfficialSourceLink({
  sources = {},
  topicId,
  officialUrl = "",
  officialLabel = "",
  sourceId: requestedSourceId,
  label,
  compact = false,
  showStatusNote = true,
}) {
  const link = resolveOfficialLink(sourcesConfig, sources, { topicId, officialUrl, sourceId: requestedSourceId });
  if (!link) return null;
  const { url, directUrl, source } = link;
  let note = directUrl
    ? "Check the official page for current information."
    : checkedLabel(source.lastSuccessfulCheck);
  if (!directUrl && compact && source.status === "current") note = "";
  let className = "official-source";
  if (!directUrl && source.status === "stale") {
    note = compact
      ? "Latest information could not be verified recently."
      : "We could not verify the latest information recently.";
    className += " is-stale";
  } else if (!directUrl && source.status === "needs-review") {
    note = compact ? "Some details need review." : "Please confirm current details on the official page.";
    className += " needs-review";
  } else if (!directUrl && source.status === "unavailable") {
    note = compact ? "Live verification is unavailable." : "Check the official page for current information.";
    className += " is-unavailable";
  }
  return (
    <aside className={`${className}${compact ? " is-compact" : ""}`}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        {compact ? (
          <>
            <span>
              {officialLabel || label || "Official information"} · Bauhaus-Universität Weimar
              <span aria-hidden="true"> ↗</span>
            </span>
          </>
        ) : (
          <>
            {officialLabel || label || "Official information"} <span aria-hidden="true">↗</span>
            <span className="official-source-name">Bauhaus-Universität Weimar</span>
          </>
        )}
      </a>
      {showStatusNote && note && <small>{note}</small>}
    </aside>
  );
}
