import healthInsurance from "../../content/app-content/health-insurance.json";
import usefulLinks from "../../content/app-content/useful-links.json";
import rundfunk from "../../content/app-content/rundfunk.json";
import community from "../../content/app-content/community.json";
import supportResources from "../../content/app-content/support-resources.json";
import communityResources from "../../content/app-content/community-resources.json";
import officialLinks from "../../content/app-content/official-links.json";
import sourcesConfig from "../../content/app-content/sources.json";
import { useEffect, useState } from "react";
import { validateContent } from "../../shared/content";
import config from "../../content/app-content/config.json";
import onboarding from "../../content/app-content/onboarding.json";
import events from "../../content/app-content/events.json";
import afterArrival from "../../content/app-content/after-arrival.json";
const samples = {
  config,
  onboarding,
  events,
  "after-arrival": afterArrival,
  "health-insurance": healthInsurance,
  "useful-links": usefulLinks,
  rundfunk,
  community,
  "support-resources": supportResources,
  "community-resources": communityResources,
  "official-links": officialLinks,
};
function fallbackSources() {
  return Object.fromEntries(
    Object.entries(sourcesConfig.sources).map(([sourceId, source]) => [
      sourceId,
      {
        sourceId,
        label: source.label,
        url: source.url,
        status: "unavailable",
        lastSuccessfulCheck: "",
        lastChangedAt: "",
        warnings: [],
        data: null,
      },
    ]),
  );
}
export function useContent() {
  const [state, setState] = useState({ loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let active = true;
    fetch("/api/content", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json();
      })
      .then((bundle) => {
        const entries = Object.entries(samples).map(([kind, sample]) => {
          const source = bundle.sources?.[kind];
          if (!["demo", "nextcloud"].includes(source))
            return [
              kind,
              { source: "demo", data: validateContent(kind, sample) },
            ];
          try {
            return [
              kind,
              { source, data: validateContent(kind, bundle.data?.[kind]) },
            ];
          } catch {
            return [
              kind,
              { source: "demo", data: validateContent(kind, sample) },
            ];
          }
        });
        if (active)
          setState({
            loading: false,
            ...Object.fromEntries(entries),
            officialSources: bundle.officialSources || fallbackSources(),
            communityFeed: bundle.communityFeed || "unavailable",
          });
      })
      .catch(() => {
        if (active)
          setState({
            loading: false,
            ...Object.fromEntries(
              Object.entries(samples).map(([kind, sample]) => [
                kind,
                { source: "demo", data: validateContent(kind, sample) },
              ]),
            ),
            officialSources: fallbackSources(),
            communityFeed: "unavailable",
          });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [attempt]);
  return {
    ...state,
    retry: () => {
      setState({ loading: true });
      setAttempt((x) => x + 1);
    },
  };
}
