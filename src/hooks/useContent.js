import { useEffect, useState } from "react";
import { validateContent } from "../../shared/content";
import config from "../../content/app-content/config.json";
import onboarding from "../../content/app-content/onboarding.json";
import events from "../../content/app-content/events.json";
import afterArrival from "../../content/app-content/after-arrival.json";
const samples = { config, onboarding, events, "after-arrival": afterArrival };
export function useContent() {
  const [state, setState] = useState({ loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let active = true;
    Promise.all(
      Object.entries(samples).map(async ([kind, sample]) => {
        try {
          const response = await fetch(`/api/content/${kind}`, {
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("unavailable");
          const result = await response.json();
          if (!["demo", "nextcloud"].includes(result.source))
            throw new Error("invalid");
          return [
            kind,
            { ...result, data: validateContent(kind, result.data) },
          ];
        } catch {
          return [
            kind,
            { source: "demo", data: validateContent(kind, sample) },
          ];
        }
      }),
    )
      .then((entries) => {
        if (active)
          setState({ loading: false, ...Object.fromEntries(entries) });
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
