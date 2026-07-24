import { Link, Outlet } from 'react-router-dom';
import { useSheetData } from '../hooks/useSheetData';

export default function Layout() {
  // Fetch the directory here so the sidebar knows what links to build
const { directory, allContent, isLoading, error } = useSheetData();
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Information Directory</h1>
      </header>
      
      <div className="app-body">
        <aside className="app-sidebar">
          <h3>All Topics</h3>
          
          {isLoading && <p>Loading topics...</p>}
          {error && <p className="error-text">Error loading topics</p>}
          
          {!isLoading && !error && (
            <nav>
              <ul className="sidebar-list">
                {directory.map((topic) => (
                  <li key={topic.id}>
                    <Link to={`/topic/${encodeURIComponent(topic.id)}`} className="sidebar-link">
  {topic.title}
</Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </aside>
        
        <main className="app-main">
          {/* <Outlet /> is the placeholder where React Router injects the current page. */}
          {/* We pass the directory context down so the search page can use it instantly. */}
<Outlet context={{ directory, allContent, isLoading, error }} />
        </main>
      </div>
      
      <footer className="app-footer">
        <p>Admin Directory System</p>
      </footer>
    </div>
  );
}