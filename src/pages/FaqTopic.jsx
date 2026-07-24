import { useParams, Link, useOutletContext } from 'react-router-dom';

export default function FaqTopic() {
  // Grab the dynamic ID from the URL
  const { topicId } = useParams();
  
  // Grab the master content list passed down from the Layout
  const { allContent, isLoading, error } = useOutletContext();

  if (isLoading) return <div className="loading-container">Loading topic...</div>;
  if (error) return <div className="error-container">Error: {error}</div>;

  // React Router encodes the URL for safety, so we decode it to match your Google Sheet
  const currentTopicName = decodeURIComponent(topicId);
  
  // Instantly filter the master list to only get the rows for this specific topic
  const topicBlocks = allContent.filter(block => block.topicId === currentTopicName);

  // If the admin created a directory link but hasn't written content for it yet
  if (topicBlocks.length === 0) {
    return (
      <div className="topic-container">
        <Link to="/" className="back-button">← Back to Directory</Link>
        <h2 className="topic-subheading">This topic is empty or doesn't exist yet.</h2>
      </div>
    );
  }

  return (
    <div className="topic-container">
      <Link to="/" className="back-button">← Back to Directory</Link>
      
      <div className="topic-content">
        {topicBlocks.map(block => {
          switch(block.type) {
            case 'Heading':
              return <h1 key={block.uniqueId} className="topic-heading">{block.text}</h1>;
            
            case 'Subheading':
              return <h2 key={block.uniqueId} className="topic-subheading">{block.text}</h2>;
            
            case 'Paragraph':
              return <p key={block.uniqueId} className="topic-paragraph">{block.text}</p>;
            
            case 'List Item':
              return <li key={block.uniqueId} className="topic-list-item">{block.text}</li>;
              
            case 'Warning Box':
              return (
                <div key={block.uniqueId} className="topic-warning">
                  <strong>Important:</strong> {block.text}
                </div>
              );

            default:
              return <p key={block.uniqueId} className="topic-paragraph">{block.text}</p>;
          }
        })}
      </div>
    </div>
  );
}