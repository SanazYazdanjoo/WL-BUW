import { Link, Outlet, useSearchParams } from 'react-router-dom';
import { nextcloudFolderUrl, useNextcloudData } from '../hooks/useNextcloudData';

export default function Layout() {
  const [params] = useSearchParams();
  const path = params.get('path') || '';
  const data = useNextcloudData(path);
  return (
    <div className="app-container">
      <header className="app-header"><h1>Welcome Lounge · Files</h1></header>
      <div className="app-body">
        <aside className="app-sidebar">
          <Link to="/" className="sidebar-home-link">All files</Link>
          <a href={nextcloudFolderUrl} target="_blank" rel="noopener noreferrer" className="sidebar-link">Open Nextcloud</a>
        </aside>
        <main className="app-main"><Outlet context={{ ...data, path }} /></main>
      </div>
      <footer className="app-footer"><p>Welcome.Lounge_WiSe2026_27 / S.Y</p></footer>
    </div>
  );
}
