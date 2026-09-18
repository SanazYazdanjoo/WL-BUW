import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { arrangeJourneyTopics, findNextJourneyTopic } from "../services/journeyLayout";

function curveBetween(start, end, index, columns, copyBottom, mapWidth, edgeSpace) {
  if (columns === 1) {
    const turnY = Math.min(Math.max(start.y + 25, copyBottom + 9), end.y - 25);
    const direction = Math.sign(end.x - start.x) || 1;
    const radius = Math.min(18, Math.abs(end.x - start.x) / 4, (turnY - start.y) / 3, (end.y - turnY) / 3);
    return `M ${start.x} ${start.y} L ${start.x} ${turnY - radius} C ${start.x} ${turnY - radius / 3} ${start.x + direction * radius / 3} ${turnY} ${start.x + direction * radius} ${turnY} L ${end.x - direction * radius} ${turnY} C ${end.x - direction * radius / 3} ${turnY} ${end.x} ${turnY + radius / 3} ${end.x} ${turnY + radius} L ${end.x} ${end.y}`;
  }
  if (index % columns === columns - 1) {
    const outside = start.x >= mapWidth / 2 ? 1 : -1;
    const dy = end.y - start.y;
    const desiredRadius = Math.min(82, Math.max(58, Math.abs(dy) * 0.42));
    const availableSpace = outside > 0 ? edgeSpace?.right : edgeSpace?.left;
    const radius = Math.min(desiredRadius, availableSpace ?? desiredRadius);
    const turnX = (start.x + end.x) / 2 + outside * radius;
    const turnY = (start.y + end.y) / 2;
    return `M ${start.x} ${start.y} C ${start.x + outside * radius * 0.55} ${start.y + dy * 0.12} ${turnX} ${start.y + dy * 0.28} ${turnX} ${turnY} C ${turnX} ${turnY + dy * 0.22} ${end.x + outside * radius * 0.55} ${end.y - dy * 0.12} ${end.x} ${end.y}`;
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const direction = index % 2 === 0 ? 1 : -1;
  const bend = Math.min(24, length * 0.07) * direction;
  const controlX = (start.x + end.x) / 2 - (dy / length) * bend;
  const controlY = (start.y + end.y) / 2 + (dx / length) * bend;
  return `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`;
}

export default function JourneyMap({ topics, completedTopicIds = [] }) {
  const mapRef = useRef(null);
  const itemRefs = useRef([]);
  const nodeRefs = useRef([]);
  const titleRefs = useRef([]);
  const copyRefs = useRef([]);
  const geometryRef = useRef("");
  const pointerRef = useRef(null);
  const pathRefs = useRef([]);
  const [columns, setColumns] = useState(3);
  const [geometry, setGeometry] = useState({ width: 0, height: 0, points: [] });
  const topicCount = topics.length;
  const completed = new Set(completedTopicIds);
  const arranged = arrangeJourneyTopics(topics, columns);
  const nextTopicId = findNextJourneyTopic(topics, completedTopicIds)?.id;

  useEffect(() => {
    const map = mapRef.current;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
    if (!map || reducedMotion || !finePointer) return undefined;
    const nodes = nodeRefs.current;
    const titles = titleRefs.current;

    let frame = 0;
    let offsets = [];
    const animate = () => {
      const pointer = pointerRef.current;
      let moving = false;
      const points = geometry.points.map((point, index) => {
        if (!point) return point;
        const node = nodeRefs.current[index];
        if (!node) return point;
        const title = titleRefs.current[index];
        const current = offsets[index] || { x: 0, y: 0 };
        let targetX = 0;
        let targetY = 0;
        if (pointer) {
          let dx = point.x - pointer.x;
          let dy = point.y - pointer.y;
          let distance = Math.hypot(dx, dy);
          if (distance < 0.01) {
            dx = index % 2 === 0 ? 1 : -1;
            dy = -0.35;
            distance = Math.hypot(dx, dy);
          }
          const influence = Math.max(0, 1 - distance / 92);
          const strength = 11 * influence;
          targetX = (dx / distance) * strength;
          targetY = (dy / distance) * strength;
        }
        const next = {
          x: current.x + (targetX - current.x) * 0.18,
          y: current.y + (targetY - current.y) * 0.18,
        };
        if (Math.abs(next.x - targetX) + Math.abs(next.y - targetY) > 0.15) moving = true;
        else { next.x = targetX; next.y = targetY; }
        offsets[index] = next;
        node.style.transform = next.x === 0 && next.y === 0
          ? ""
          : `translate(${next.x}px, ${next.y}px)`;
        if (title) {
          title.style.transform = next.x === 0 && next.y === 0
            ? ""
            : `translate(${next.x}px, ${next.y}px)`;
        }
        return { x: point.x + next.x, y: point.y + next.y };
      });

      points.slice(0, -1).forEach((point, index) => {
        const next = points[index + 1];
        const path = pathRefs.current[index];
        if (point && next && path) {
          path.setAttribute("d", curveBetween(point, next, index, columns, geometry.copyBottoms[index], geometry.width, geometry.edgeSpaces[index]));
        }
      });
      if (moving) frame = window.requestAnimationFrame(animate);
      else frame = 0;
    };

    const updatePointer = (event) => {
      if (event.pointerType !== "mouse") return;
      const rect = map.getBoundingClientRect();
      pointerRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      if (!frame) frame = window.requestAnimationFrame(animate);
    };
    const clearPointer = () => {
      pointerRef.current = null;
      if (!frame) frame = window.requestAnimationFrame(animate);
    };
    map.addEventListener("pointermove", updatePointer);
    map.addEventListener("pointerleave", clearPointer);
    return () => {
      map.removeEventListener("pointermove", updatePointer);
      map.removeEventListener("pointerleave", clearPointer);
      if (frame) window.cancelAnimationFrame(frame);
      nodes.forEach((node) => { if (node) node.style.transform = ""; });
      titles.forEach((title) => { if (title) title.style.transform = ""; });
      pathRefs.current = [];
    };
  }, [columns, geometry]);

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    const update = () => {
      const width = map.clientWidth;
      const nextColumns = width >= 900 ? 3 : width >= 600 ? 2 : 1;
      setColumns((current) => current === nextColumns ? current : nextColumns);
      const bounds = map.getBoundingClientRect();
      const height = map.scrollHeight;
      const points = Array.from({ length: topicCount }, (_, index) => {
        const node = nodeRefs.current[index];
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return {
          x: rect.left - bounds.left + rect.width / 2,
          y: rect.top - bounds.top + rect.height / 2,
        };
      });
      const copyBottoms = Array.from({ length: topicCount }, (_, index) => {
        const copy = copyRefs.current[index];
        return copy ? copy.getBoundingClientRect().bottom - bounds.top : 0;
      });
      const edgeSpaces = points.map((point) => point && ({
        left: Math.max(0, bounds.left + point.x),
        right: Math.max(0, window.innerWidth - bounds.left - point.x),
      }));
      const signature = JSON.stringify({ width, height, points, copyBottoms, edgeSpaces });
      if (signature !== geometryRef.current) {
        geometryRef.current = signature;
        setGeometry({ width, height, points, copyBottoms, edgeSpaces });
      }
    };

    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(update);
    observer?.observe(map);
    itemRefs.current.forEach((item) => observer?.observe(item));
    window.addEventListener("resize", update);
    update();
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [topicCount, columns]);

  return (
    <div className="journey-map" ref={mapRef}>
      {topics.length > 1 && geometry.width > 0 && (
        <svg
          aria-hidden="true"
          className="journey-map-path"
          focusable="false"
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          preserveAspectRatio="none"
        >
          {geometry.points.slice(0, -1).map((point, index) => {
            const next = geometry.points[index + 1];
            if (!point || !next) return null;
            const isProgressed = completed.has(topics[index].id);
            return (
              <path
                key={`${topics[index].id}-${topics[index + 1].id}`}
                d={curveBetween(point, next, index, columns, geometry.copyBottoms[index], geometry.width, geometry.edgeSpaces[index])}
                className={isProgressed ? "journey-path-segment is-progressed" : "journey-path-segment"}
                ref={(element) => { pathRefs.current[index] = element; }}
                style={{ "--path-delay": `${index * 880}ms` }}
              />
            );
          })}
        </svg>
      )}
      <ol
        className="journey-map-list"
        aria-label="Your first steps"
        data-columns={columns}
        style={{ "--journey-columns": columns }}
      >
        {arranged.map(({ topic, index, row, column }) => {
          const isComplete = completed.has(topic.id);
          const isNext = topic.id === nextTopicId;
          return (
            <li
              className={`journey-map-step${isComplete ? " is-complete" : ""}`}
              data-column={column + 1}
              data-row={row + 1}
              data-side={index % 2 === 0 ? "left" : "right"}
              key={topic.id}
              ref={(element) => { itemRefs.current[index] = element; }}
              style={{
                "--step-column": column + 1,
                "--step-row": row + 1,
                "--step-delay": `${index * 880}ms`,
              }}
            >
              <Link
                aria-label={`Open step ${index + 1}: ${topic.title}${isComplete ? ", completed" : ""}${isNext ? ", next incomplete step" : ""}`}
                aria-describedby={`${topic.id}-summary`}
                className="journey-map-link"
                to={`/journey/${topic.id}`}
              >
                <span
                  aria-hidden="true"
                  className={`journey-map-node${isNext ? " is-next" : ""}`}
                  ref={(element) => { nodeRefs.current[index] = element; }}
                >
                  {isComplete ? "✓" : String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className="journey-map-copy"
                  ref={(element) => { copyRefs.current[index] = element; }}
                >
                  <span className="journey-map-title">
                    <span
                      className="journey-map-title-text"
                      ref={(element) => { titleRefs.current[index] = element; }}
                    >{topic.title}</span>
                    {isComplete && <span className="sr-only">, completed</span>}
                    {isNext && <span className="sr-only">, next incomplete step</span>}
                  </span>
                  <span className="journey-map-summary" id={`${topic.id}-summary`}>
                    {topic.summary}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
