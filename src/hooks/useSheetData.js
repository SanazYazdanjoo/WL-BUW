import { useState, useEffect } from 'react';

export function useSheetData() {
  const [directory, setDirectory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSheet = async () => {
      // These pull from your .env.local file
      const SHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;
      const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
      
      // The exact name of your main index tab in Google Sheets
      const TAB_NAME = 'Directory_Index'; 
      
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${TAB_NAME}?key=${API_KEY}`;

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch the directory.');
        
        const data = await response.json();
        
        // Skip row 0 (headers) and map the rest to an object array
        const formattedData = data.values.slice(1).map(row => ({
          id: row[0] || '',
          title: row[1] || '',
          keywords: row[2] || '',
          summary: row[3] || ''
        }));

        setDirectory(formattedData);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSheet();
  }, []);

  return { directory, isLoading, error };
}