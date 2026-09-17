import healthInsurance from "../../content/app-content/health-insurance.json";
import usefulLinks from "../../content/app-content/useful-links.json";
import rundfunk from "../../content/app-content/rundfunk.json";
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
};
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
          setState({ loading: false, ...Object.fromEntries(entries) });
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
