import { useParams, Link, useOutletContext } from 'react-router-dom';

export default function FaqTopic() {
  const { topicId } = useParams();
  const { allContent, isLoading, error } = useOutletContext();

  if (isLoading) return <div className="loading-container">Loading topic...</div>;
  if (error) return <div className="error-container">Error: {error}</div>;

  const currentTopicName = decodeURIComponent(topicId);
  const topicBlocks = allContent.filter(block => block.topicId === currentTopicName);

  if (topicBlocks.length === 0) {
    return (
      <div className="topic-container">
        <Link to="/" className="back-button">← Back to Directory</Link>
        <h2 className="topic-subheading">This topic is empty or doesn't exist yet.</h2>
      </div>
    );
  }

  // Find if there is a banner image for this topic
  const bannerBlock = topicBlocks.find(block => block.type === 'Banner');
  // Get all the rest of the text blocks
  const contentBlocks = topicBlocks.filter(block => block.type !== 'Banner');

  return (
    <div className="topic-container">
      <Link to="/" className="back-button">← Back to Directory</Link>
      
      <div className="topic-content">
        {/* Render banner at the very top if it exists */}
        {bannerBlock && (
          <div className="topic-banner-image-container">
            <img 
              src={bannerBlock.text} 
              alt="Topic Banner" 
            />
          </div>
        )}

        {/* Render the rest of the content */}
        {contentBlocks.map(block => {
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

            case 'Event Date':
              return (
                <div key={block.uniqueId} className="topic-event-date" style={{ margin: '16px 0', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                  🗓️ <strong>Event Date:</strong> {block.text}
                </div>
              );

            case 'Link':
              return (
                <div key={block.uniqueId} className="topic-link-wrapper" style={{ margin: '16px 0' }}>
                  🔗 <a 
                    href={block.text} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{ color: 'var(--accent-color)', fontWeight: '500', textDecoration: 'underline' }}
                  >
                    {block.text}
                  </a>
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