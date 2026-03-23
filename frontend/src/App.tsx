import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import ForcePasswordReset from './pages/ForcePasswordReset';
import Dashboard from './pages/Dashboard';
import SystemList from './pages/systems/SystemList';
import SystemForm from './pages/systems/SystemForm';
import RiskList from './pages/risks/RiskList';
import RiskForm from './pages/risks/RiskForm';
import LifecycleView from './pages/lifecycle/LifecycleView';
import IncidentList from './pages/incidents/IncidentList';
import IncidentForm from './pages/incidents/IncidentForm';
import OversightList from './pages/oversight/OversightList';
import MonitoringList from './pages/monitoring/MonitoringList';
import TrainingList from './pages/training/TrainingList';
import TrainingCourse from './pages/training/TrainingCourse';
import AuditList from './pages/audits/AuditList';
import RolesList from './pages/roles/RolesList';
import ComplianceView from './pages/compliance/ComplianceView';
import DocumentList from './pages/documents/DocumentList';
import DocumentView from './pages/documents/DocumentView';
import Settings from './pages/Settings';
import UserManagement from './pages/admin/UserManagement';
import StandardsSettings from './pages/admin/StandardsSettings';
import OrganisationList from './pages/admin/OrganisationList';
import SchedulingView from './pages/scheduling/SchedulingView';
import QuestionBank from './pages/training/QuestionBank';
import ActivityLog from './pages/ActivityLog';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/force-password-reset" element={<ForcePasswordReset />} />
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="systems" element={<SystemList />} />
            <Route path="systems/new" element={<SystemForm />} />
            <Route path="risks" element={<RiskList />} />
            <Route path="risks/new" element={<RiskForm />} />
            <Route path="lifecycle" element={<LifecycleView />} />
            <Route path="incidents" element={<IncidentList />} />
            <Route path="incidents/new" element={<IncidentForm />} />
            <Route path="oversight" element={<OversightList />} />
            <Route path="monitoring" element={<MonitoringList />} />
            <Route path="training" element={<TrainingList />} />
            <Route path="training/modules/:slug" element={<TrainingCourse />} />
            <Route path="training/modules/:slug/questions" element={<QuestionBank />} />
            <Route path="scheduling" element={<SchedulingView />} />
            <Route path="audits" element={<AuditList />} />
            <Route path="documents" element={<DocumentList />} />
            <Route path="documents/:slug" element={<DocumentView />} />
            <Route path="roles" element={<RolesList />} />
            <Route path="compliance" element={<ComplianceView />} />
            <Route path="activity-log" element={<ActivityLog />} />
            <Route path="settings" element={<Settings />} />
            <Route path="admin/users" element={<UserManagement />} />
            <Route path="admin/standards" element={<StandardsSettings />} />
            <Route path="admin/organisations" element={<OrganisationList />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
