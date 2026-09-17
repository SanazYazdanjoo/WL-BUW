import sourcesConfig from "../../content/app-content/sources.json";

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
  sourceId: requestedSourceId,
  label,
  compact = false,
}) {
  const mapping = topicId ? sourcesConfig.topicMappings[topicId] : null;
  const sourceId = requestedSourceId || mapping?.sourceId;
  if (!sourceId) return null;
  const configured = sourcesConfig.sources[sourceId];
  if (!configured) return null;
  const source = sources[sourceId] || {
    sourceId,
    label: configured.label,
    url: configured.url,
    status: "unavailable",
  };
  const section = mapping?.sectionId
    ? source.data?.sections?.find((item) => item.id === mapping.sectionId)
    : null;
  const url = section?.officialUrl || source.url || configured.url;
  let note = checkedLabel(source.lastSuccessfulCheck);
  if (compact && source.status === "current") note = "";
  let className = "official-source";
  if (source.status === "stale") {
    note = compact
      ? "Latest information could not be verified recently."
      : "We could not verify the latest information recently.";
    className += " is-stale";
  } else if (source.status === "needs-review") {
    note = compact ? "Some details need review." : "Please confirm current details on the official page.";
    className += " needs-review";
  } else if (source.status === "unavailable") {
    note = compact ? "Live verification is unavailable." : "Check the official page for current information.";
    className += " is-unavailable";
  }
  return (
    <aside className={`${className}${compact ? " is-compact" : ""}`}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        {compact ? (
          <>
            <span>
              {label || "Official information"} · Bauhaus-Universität Weimar
              <span aria-hidden="true"> ↗</span>
            </span>
          </>
        ) : (
          <>
            {label || "Official information"} <span aria-hidden="true">↗</span>
            <span className="official-source-name">Bauhaus-Universität Weimar</span>
          </>
        )}
      </a>
      {note && <small>{note}</small>}
    </aside>
  );
}
