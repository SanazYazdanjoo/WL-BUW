import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

export default function DirectoryIndex() {
  // Grab the data passed down from Layout via useOutletContext
  const { directory, isLoading, error } = useOutletContext();
  
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Handle Loading State
  if (isLoading) {
    return (
      <div className="loading-container">
        <h2>Loading FAQ Directory...</h2>
      </div>
    );
  }

  // 2. Handle Error State
  if (error) {
    return (
      <div className="error-container">
        <h2>Error loading directory</h2>
        <p>{error}</p>
      </div>
    );
  }

  // 3. The Instant Search Logic
  // This filters the list in real-time checking both the visible title and hidden keywords
  const searchResults = directory.filter((page) => {
    const term = searchTerm.toLowerCase();
    return (
      page.title.toLowerCase().includes(term) ||
      page.keywords.toLowerCase().includes(term)
    );
  });

  // 4. Render the UI
  return (
    <div className="directory-container">
      <header className="directory-header">
        <h1>Information Directory</h1>
        <p>Search for a topic or browse the categories below.</p>
        
        <input
          type="text"
          className="search-bar"
          placeholder="e.g., 'Exam rules', 'Schedules', 'Grading'..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </header>

      <main className="topic-list">
        {searchResults.length > 0 ? (
          searchResults.map((page) => (
            <Link 
      to={`/topic/${encodeURIComponent(page.id)}`} 
      key={page.id} 
      className="topic-card-link"
    >
      <div className="topic-card">
        <h2>{page.title}</h2>
        <p>{page.summary}</p>
      </div>
    </Link>
          ))
        ) : (
          <div className="no-results">
            <p>No topics found matching "{searchTerm}". Try another keyword.</p>
          </div>
        )}
      </main>
    </div>
  );
}