export function arrangeJourneyTopics(topics, columns) {
  const columnCount = Number.isInteger(columns) && columns > 0 ? columns : 1;
  return topics.map((topic, index) => {
    const row = Math.floor(index / columnCount);
    const positionInRow = index % columnCount;
    const column = row % 2 === 0
      ? positionInRow
      : columnCount - 1 - positionInRow;
    return { topic, index, row, column };
  });
}

export function findNextJourneyTopic(topics, completedTopicIds = []) {
  const completed = new Set(completedTopicIds);
  return topics.find((topic) => !completed.has(topic.id));
}
