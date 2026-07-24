import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DirectoryIndex from './pages/DirectoryIndex';
import FaqTopic from './pages/FaqTopic';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Routes>
          {/* Main FAQ search and directory listing */}
          <Route path="/" element={<DirectoryIndex />} />
          
          {/* Dynamic route for individual topic pages */}
          <Route path="/topic/:topicId" element={<FaqTopic />} />
          
          {/* Fallback route: redirects invalid URLs back to the directory */}
          <Route path="*" element={<DirectoryIndex />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}