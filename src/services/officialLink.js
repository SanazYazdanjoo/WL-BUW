// Where a topic's official link points. A link typed into the workbook (officialUrl) is shown
// even when the topic has no entry in sources.json; the mapping only adds live-check status.
export function resolveOfficialLink(config, sources, { topicId, officialUrl = "", sourceId: requestedSourceId }) {
  const mapping = topicId ? config.topicMappings[topicId] : null;
  const sourceId = requestedSourceId || mapping?.sourceId;
  const configured = sourceId ? config.sources[sourceId] : null;
  const directUrl = officialUrl || mapping?.url;
  if (!configured && !directUrl) return null;
  const source = configured ? sources[sourceId] || {
    sourceId,
    label: configured.label,
    url: configured.url,
    status: "unavailable",
  } : null;
  const section = mapping?.sectionId
    ? source?.data?.sections?.find((item) => item.id === mapping.sectionId)
    : null;
  const url = directUrl || section?.officialUrl || source.url || configured.url;
  return { url, directUrl, source };
}
