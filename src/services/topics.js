// Route lookup stays independent from whether content came from Nextcloud or samples.
export function findTopic(topics, id) {
  return topics.find((topic) => topic.isActive && topic.id === id);
}
