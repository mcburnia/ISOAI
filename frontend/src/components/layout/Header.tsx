import { useLocation } from 'react-router-dom';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/systems': 'AI System Inventory',
  '/lifecycle': 'System Lifecycle',
  '/risks': 'Risk Register',
  '/incidents': 'Incident Management',
  '/monitoring': 'Monitoring & Performance',
  '/oversight': 'Human Oversight',
  '/roles': 'Roles & Responsibilities',
  '/training': 'Training & Competence',
  '/audits': 'Audits & Reviews',
  '/documents': 'Policy Documents',
  '/compliance': 'Control Mapping',
  '/activity-log': 'Activity Log',
  '/settings': 'Account Settings',
  '/admin/users': 'User Management',
  '/admin/standards': 'Standards',
};

export default function Header() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);
  const basePath = '/' + segments.slice(0, 2).join('/');
  const isTrainingModule = segments[0] === 'training' && segments[1] === 'modules';
  const title = isTrainingModule ? 'Training & Competence' : pageTitles[location.pathname] || pageTitles[basePath] || 'ISOAI';

  return (
    <header className="h-14 border-b border-border bg-card flex items-center px-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    </header>
  );
}
