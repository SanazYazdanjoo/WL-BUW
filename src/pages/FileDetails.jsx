import { Link, useOutletContext, useParams } from 'react-router-dom';

export default function FileDetails() {
  const { topicId } = useParams();
  const { directory, path, isLoading, error } = useOutletContext();
  const file = directory.find(entry => entry.name === topicId && !entry.isFolder);
  const back = `/?path=${encodeURIComponent(path)}`;
  if (isLoading) return <p role="status">Loading file…</p>;
  if (error) return <div role="alert"><p>{error}</p><Link to={back}>Back to folder</Link></div>;
  if (!file) return <div><h2>File not found</h2><Link to={back}>Back to folder</Link></div>;
  const nextcloudUrl = `https://nextcloud.uni-weimar.de/apps/files/files?dir=${encodeURIComponent(`/Welcome.Lounge_WiSe2026_27/S.Y${path ? `/${path}` : ''}`)}&scrollto=${encodeURIComponent(file.name)}`;
  return (
    <div className="topic-container">
      <Link to={back} className="back-button">← Back to folder</Link>
      <article className="topic-content">
        <h1 className="topic-heading">{file.name}</h1>
        <p className="topic-paragraph">{file.mimeType || 'File'} · {new Intl.NumberFormat().format(file.size)} bytes</p>
        <p className="topic-paragraph">Download this file to open it with a compatible app, or view it in Nextcloud.</p>
        <div className="file-actions">
          <a href={`/api/nextcloud/download?path=${encodeURIComponent(file.path)}`} download={file.name}>Download file</a>
          <a href={nextcloudUrl} target="_blank" rel="noopener noreferrer">Open in Nextcloud</a>
        </div>
      </article>
    </div>
  );
}
