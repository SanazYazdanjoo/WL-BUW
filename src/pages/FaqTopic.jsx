import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

export default function FaqTopic() {
  // 1. Grab the dynamic ID from the URL (e.g., "exam_rules")
  const { topicId } = useParams();
  
  const [contentBlocks, setContentBlocks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTopic = async () => {
      const SHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;
      const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
      
      // 2. The topicId becomes the exact Tab Name requested from the Google Sheet
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(topicId)}?key=${API_KEY}`;

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Topic not found in the spreadsheet.');
        
        const data = await response.json();
        
        // 3. Format the data. Assuming Column A (index 0) is Type and Column B (index 1) is Content
        // We slice(1) to skip the first row (the column headers in your sheet)
        const formattedData = data.values.slice(1).map((row, index) => ({
          id: `block-${index}`,
          type: row[0] || 'Paragraph', 
          text: row[1] || ''
        }));

        setContentBlocks(formattedData);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopic();
  }, [topicId]); // Re-runs the fetch if the user navigates to a new topic ID

  // 4. Handle states
  if (isLoading) return <div className="loading-container">Loading topic...</div>;
  if (error) return <div className="error-container">Error: {error}</div>;

  // 5. Render the page using a Block Mapper (switch statement)
  return (
    <div className="topic-container">
      <Link to="/" className="back-button">← Back to Directory</Link>
      
      <div className="topic-content">
        {contentBlocks.map(block => {
          switch(block.type) {
            case 'Heading':
              return <h1 key={block.id} className="topic-heading">{block.text}</h1>;
            
            case 'Subheading':
              return <h2 key={block.id} className="topic-subheading">{block.text}</h2>;
            
            case 'Paragraph':
              return <p key={block.id} className="topic-paragraph">{block.text}</p>;
            
            case 'List Item':
              return <li key={block.id} className="topic-list-item">{block.text}</li>;
              
            case 'Warning Box':
              return (
                <div key={block.id} className="topic-warning">
                  <strong>Important:</strong> {block.text}
                </div>
              );
              
            // Example of how you would embed a custom interactive component later
            case 'Info Widget':
              return (
                <div key={block.id} className="info-widget-placeholder">
                  Interactive Widget Data: {block.text}
                </div>
              );

            // Fallback just in case the admin types a type that doesn't exist
            default:
              return <p key={block.id} className="topic-paragraph">{block.text}</p>;
          }
        })}
      </div>
    </div>
  );
}