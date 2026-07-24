import { useState, useEffect } from 'react';

export function useSheetData() {
  const [directory, setDirectory] = useState([]);
  const [allContent, setAllContent] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSheets = async () => {
      const SHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;
      const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
      
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet?ranges=Directory_Index&ranges=All_Content&key=${API_KEY}`;

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch data from Google Sheets.');
        
        const data = await response.json();
        
        // 1. Parse Directory_Index
        const directoryData = data.valueRanges[0].values?.slice(1).map(row => ({
          id: row[0] || '',
          title: row[1] || '',
          keywords: row[2] || '',
          summary: row[3] || ''
        })) || [];

        // 2. Parse All_Content based on your column structure
        const contentRows = data.valueRanges[1].values || [];
        if (contentRows.length === 0) {
          setDirectory(directoryData);
          setAllContent([]);
          setIsLoading(false);
          return;
        }

        // Row 0 contains the column headers (e.g. "topic_id", "Banner", "Heading", etc.)
        const headers = contentRows[0]; 
        const parsedBlocks = [];

        // Loop through data rows starting from Row 1 (skipping the header row index 0)
        contentRows.slice(1).forEach((row, rowIndex) => {
          const topicId = row[0] || ''; // Column A: topic_id
          if (!topicId) return;

          // Check each column dynamically against the header name
          headers.forEach((headerName, colIndex) => {
            const cellText = row[colIndex];
            
            // Skip empty cells, Column A (topic_id), and ensure we don't read header text
            if (!cellText || colIndex === 0) return;

            parsedBlocks.push({
              uniqueId: `block-${rowIndex}-${colIndex}`,
              topicId: topicId,
              type: headerName.trim(), // e.g. "Banner", "Heading", "Paragraph", etc.
              text: cellText
            });
          });
        });

        setDirectory(directoryData);
        setAllContent(parsedBlocks);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSheets();
  }, []);

  return { directory, allContent, isLoading, error };
}