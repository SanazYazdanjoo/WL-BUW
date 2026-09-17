import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import DirectoryIndex from './pages/DirectoryIndex';
import FileDetails from './pages/FileDetails';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* The Layout wraps all routes */}
        <Route path="/" element={<Layout />}>
          {/* index loads at the exact "/" path */}
          <Route index element={<DirectoryIndex />} />
          
          <Route path="topic/:topicId" element={<FileDetails />} />
          <Route path="*" element={<DirectoryIndex />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
