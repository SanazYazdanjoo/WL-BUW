import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { nextcloudFolderUrl } from '../hooks/useNextcloudData';

export default function DirectoryIndex() {
  const { directory, path, isLoading, error } = useOutletContext();
  const [searchTerm, setSearchTerm] = useState('');
  const parts = path.split('/').filter(Boolean);
  const results = directory.filter(entry => entry.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="directory-container">
      <header className="directory-header">
        <h1>File Directory</h1>
        <p>Browse your Nextcloud folders and files of any format.</p>
        <nav aria-label="Folder location" className="folder-breadcrumbs">
          <Link to="/">S.Y</Link>
          {parts.map((part, index) => <span key={index}> / <Link to={`/?path=${encodeURIComponent(parts.slice(0, index + 1).join('/'))}`}>{part}</Link></span>)}
        </nav>
        <input type="search" aria-label="Search this folder" className="search-bar" placeholder="Search files and folders…" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} />
      </header>
      {isLoading ? <p role="status">Loading Nextcloud files…</p> : error ? (
        <div role="alert" className="error-container">
          <h2>Files are unavailable</h2><p>{error}</p>
          <a href={nextcloudFolderUrl} target="_blank" rel="noopener noreferrer">Open the folder in Nextcloud</a>
        </div>
      ) : (
        <div className="topic-list">
          {results.length ? results.map(entry => (
            <Link key={entry.path} className="topic-card-link" to={entry.isFolder ? `/?path=${encodeURIComponent(entry.path)}` : `/topic/${encodeURIComponent(entry.name)}?path=${encodeURIComponent(path)}`}>
              <div className="topic-card"><h2>{entry.name}</h2><p>{entry.isFolder ? 'Folder' : entry.mimeType || 'File'}</p></div>
            </Link>
          )) : <p>{directory.length ? 'No files match your search.' : 'This folder is empty.'}</p>}
        </div>
      )}
    </div>
  );
}
