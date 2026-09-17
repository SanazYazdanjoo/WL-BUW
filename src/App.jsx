import StaffLayout from "./staff/StaffLayout";
import {
  Dashboard,
  Students,
  StudentDetail,
  ShiftPage,
  Tutors,
  Handover,
  Reports,
} from "./staff/WorkspacePages";
import { ImportPage, PrintCenter } from "./staff/CoordinatorPages";
import InformationPage from "./pages/InformationPage";
import OfficialSourcesPage from "./staff/OfficialSourcesPage";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import {
  AfterArrivalPage,
  EventsPage,
  FeedbackPage,
  HelpPage,
  InfoPage,
  JourneyPage,
  NotFound,
  TopicPage,
} from "./pages/StudentPages";
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="staff" element={<StaffLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="login" element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="students" element={<Students />} />
          <Route path="students/:studentId" element={<StudentDetail />} />
          <Route path="shifts" element={<ShiftPage />} />
          <Route path="program-tutors" element={<Tutors />} />
          <Route path="handover" element={<Handover />} />
          <Route path="reports" element={<Reports />} />
          <Route path="data" element={<ImportPage />} />
          <Route path="content" element={<ImportPage editorial />} />
          <Route path="sources" element={<OfficialSourcesPage />} />
          <Route path="print" element={<PrintCenter />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route element={<Layout />}>
          <Route index element={<JourneyPage />} />
          <Route path="journey" element={<JourneyPage />} />
          <Route path="journey/:topicId" element={<TopicPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="info" element={<InfoPage />} />
          <Route path="after-arrival" element={<AfterArrivalPage />} />
          <Route path="after-arrival/:topicId" element={<TopicPage later />} />
          <Route
            path="health-insurance"
            element={
              <InformationPage
                kind="health-insurance"
                title="Health insurance directory"
              />
            }
          />
          <Route
            path="useful-links"
            element={
              <InformationPage kind="useful-links" title="University portals" />
            }
          />
          <Route
            path="rundfunk"
            element={
              <InformationPage kind="rundfunk" title="Rundfunkbeitrag" />
            }
          />
          <Route path="help" element={<HelpPage />} />
          <Route path="feedback" element={<FeedbackPage />} />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
