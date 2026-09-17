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
  let className = "official-source";
  if (source.status === "stale") {
    note = "We could not verify the latest information recently.";
    className += " is-stale";
  } else if (source.status === "needs-review") {
    note = "Please confirm current details on the official page.";
    className += " needs-review";
  } else if (source.status === "unavailable") {
    note = "Check the official page for current information.";
    className += " is-unavailable";
  }
  return (
    <aside className={className}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        {label || "Official information"} <span aria-hidden="true">↗</span>
        <span className="official-source-name">Bauhaus-Universität Weimar</span>
      </a>
      {note && <small>{note}</small>}
    </aside>
  );
}
