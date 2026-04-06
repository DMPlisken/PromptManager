import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import HelpPanel from "./components/HelpPanel";
import Dashboard from "./pages/Dashboard";
import GroupPage from "./pages/GroupPage";
import TasksPage from "./pages/TasksPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import HistoryPage from "./pages/HistoryPage";
import ManualPage from "./pages/ManualPage";
import SessionsPage from "./pages/SessionsPage";
import MachinesPage from "./pages/MachinesPage";

export default function App() {
  const [helpSection, setHelpSection] = useState<string | null>(null);

  return (
    <Layout onHelp={() => setHelpSection("getting-started")}>
      <Routes>
        <Route path="/" element={<Navigate to="/tasks" replace />} />
        <Route path="/tasks" element={<TasksPage onHelp={setHelpSection} />} />
        <Route path="/tasks/:taskId" element={<TaskDetailPage onHelp={setHelpSection} />} />
        <Route path="/groups/:groupId" element={<GroupPage onHelp={setHelpSection} />} />
        <Route path="/history" element={<HistoryPage onHelp={setHelpSection} />} />
        <Route path="/manual" element={<ManualPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/machines" element={<MachinesPage />} />
        <Route path="*" element={<Navigate to="/tasks" replace />} />
      </Routes>
      <HelpPanel sectionId={helpSection} onClose={() => setHelpSection(null)} />
    </Layout>
  );
}
