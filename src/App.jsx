import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import {
  AfterArrivalPage,
  EventsPage,
  FeedbackPage,
  HelpPage,
  JourneyPage,
  NotFound,
  StaffPage,
  TopicPage,
} from "./pages/StudentPages";
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<JourneyPage />} />
          <Route path="journey" element={<JourneyPage />} />
          <Route path="journey/:topicId" element={<TopicPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="after-arrival" element={<AfterArrivalPage />} />
          <Route path="after-arrival/:topicId" element={<TopicPage later />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="feedback" element={<FeedbackPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="staff/dashboard" element={<StaffPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
