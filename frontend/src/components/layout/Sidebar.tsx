import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Server,
  GitBranch,
  AlertTriangle,
  ShieldAlert,
  Activity,
  Eye,
  GraduationCap,
  ClipboardCheck,
  Users,
  CheckCircle,
  Settings,
  LogOut,
  FileText,
  ScrollText,
  Shield,
  Building2,
} from 'lucide-react';

const navGroups = [
  {
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    title: 'AI Systems',
    items: [
      { to: '/systems', icon: Server, label: 'Inventory' },
      { to: '/lifecycle', icon: GitBranch, label: 'Lifecycle' },
    ],
  },
  {
    title: 'Risk Management',
    items: [
      { to: '/risks', icon: AlertTriangle, label: 'Risk Register' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/incidents', icon: ShieldAlert, label: 'Incidents' },
      { to: '/monitoring', icon: Activity, label: 'Monitoring' },
      { to: '/oversight', icon: Eye, label: 'Human Oversight' },
    ],
  },
  {
    title: 'Governance',
    items: [
      { to: '/documents', icon: FileText, label: 'Policy Documents' },
      { to: '/roles', icon: Users, label: 'Roles & Responsibilities' },
      { to: '/training', icon: GraduationCap, label: 'Training & Competence' },
      { to: '/audits', icon: ClipboardCheck, label: 'Audits & Reviews' },
      { to: '/compliance', icon: CheckCircle, label: 'Control Mapping' },
      { to: '/activity-log', icon: ScrollText, label: 'Activity Log' },
    ],
  },
];

const adminGroup = {
  title: 'Admin',
  items: [
    { to: '/admin/users', icon: Settings, label: 'User Management' },
    { to: '/admin/standards', icon: Shield, label: 'Standards' },
    { to: '/admin/organisations', icon: Building2, label: 'Organisations' },
  ],
};

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const allGroups = isAdmin ? [...navGroups, adminGroup] : navGroups;

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-sidebar text-sidebar-foreground flex flex-col z-50">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-sidebar-accent">
        <img src="/gibbs-logo-light.png" alt="Gibbs Consulting" className="h-7 w-auto" />
        <p className="text-[10px] text-slate-400 mt-1.5 tracking-wide">Integrated Management System</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {allGroups.map((group, gi) => (
          <div key={gi} className="mb-1">
            {group.title && (
              <p className="px-2 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {group.title}
              </p>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? 'bg-gibbs-bright text-white font-medium'
                      : 'text-slate-300 hover:bg-sidebar-accent hover:text-white'
                  }`
                }
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-accent px-3 py-3">
        <div className="flex items-center gap-2.5 px-2">
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition-opacity"
            title="Account settings"
          >
            <div className="w-8 h-8 rounded-full bg-gibbs-bright flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">
                {user?.role === 'ADMIN' ? 'Administrator' : 'User'}
              </p>
            </div>
          </button>
          <button
            onClick={logout}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
