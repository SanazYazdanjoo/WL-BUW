import { useEffect, useState } from 'react';

export const nextcloudFolderUrl = 'https://nextcloud.uni-weimar.de/apps/files/files?dir=/Welcome.Lounge_WiSe2026_27/S.Y';

export function useNextcloudData(path) {
  const [state, setState] = useState({ path: null, directory: [], isLoading: true, error: null });
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/nextcloud/files?path=${encodeURIComponent(path)}`, { signal: controller.signal });
        if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The Nextcloud service is unavailable.');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load Nextcloud files.');
        if (!Array.isArray(data.entries)) throw new Error('Invalid Nextcloud file listing.');
        setState({ path, directory: data.entries, isLoading: false, error: null });
      } catch (error) {
        if (!controller.signal.aborted) setState({ path, directory: [], isLoading: false, error: error.message });
      }
    }
    load();
    return () => controller.abort();
  }, [path]);
  return state.path === path ? state : { directory: [], isLoading: true, error: null };
}
