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
      
      // batchGet requests multiple tabs at once using the "ranges" parameter
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet?ranges=Directory_Index&ranges=All_Content&key=${API_KEY}`;

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch data from Google Sheets.');
        
        const data = await response.json();
        
        // 1. Parse the Directory_Index (valueRanges[0])
        // We use optional chaining (?.) just in case the sheet is empty
        const directoryData = data.valueRanges[0].values?.slice(1).map(row => ({
          id: row[0] || '',
          title: row[1] || '',
          keywords: row[2] || '',
          summary: row[3] || ''
        })) || [];

        // 2. Parse the All_Content master list (valueRanges[1])
        const contentData = data.valueRanges[1].values?.slice(1).map((row, index) => ({
          uniqueId: `block-${index}`,
          topicId: row[0] || '',
          type: row[1] || 'Paragraph',
          text: row[2] || ''
        })) || [];

        setDirectory(directoryData);
        setAllContent(contentData);
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