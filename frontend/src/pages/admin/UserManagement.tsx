import { useEffect, useState, FormEvent } from 'react';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Shield, User, UserPlus, X, CheckCircle, AlertCircle, Eye, ClipboardCheck } from 'lucide-react';

interface UserData { id: string; email: string; name: string; role: string; createdAt: string; }

const ROLE_OPTIONS = [
  { value: 'COMPLIANCE_USER', label: 'Compliance User' },
  { value: 'AUDITOR', label: 'Auditor' },
  { value: 'ADMIN', label: 'Administrator' },
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Platform Admin',
  ADMIN: 'Administrator',
  AUDITOR: 'Auditor',
  COMPLIANCE_USER: 'Compliance User',
};

const ROLE_BADGE_VARIANT: Record<string, 'purple' | 'info' | 'warning' | 'default'> = {
  SUPER_ADMIN: 'purple',
  ADMIN: 'purple',
  AUDITOR: 'info',
  COMPLIANCE_USER: 'default',
};

const ROLE_ICON: Record<string, typeof Shield> = {
  SUPER_ADMIN: Shield,
  ADMIN: Shield,
  AUDITOR: Eye,
  COMPLIANCE_USER: ClipboardCheck,
};

export default function UserManagement() {
  const { isAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New user form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('COMPLIANCE_USER');
  const [formLoading, setFormLoading] = useState(false);

  if (!isAdmin) return <Navigate to="/" replace />;

  const load = () => api.get('/users').then((r) => setUsers(r.data.users));
  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const changeRole = async (u: UserData, newRole: string) => {
    if (u.id === currentUser?.id) return;
    if (u.role === 'SUPER_ADMIN') return;
    try {
      await api.patch(`/users/${u.id}/role`, { role: newRole });
      setMessage({ type: 'success', text: `${u.name} updated to ${ROLE_LABELS[newRole]}` });
      load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update role' });
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('COMPLIANCE_USER');
    setShowForm(false);
  };

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setMessage(null);
    try {
      const res = await api.post('/users', { name, email, password, role });
      const emailNote = res.data.emailSent
        ? ' An invitation email has been sent.'
        : ' (Invitation email was not sent — email not configured)';
      setMessage({ type: 'success', text: `User "${name}" created successfully.${emailNote}` });
      resetForm();
      load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to create user' });
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) return <Card><div className="h-48 animate-pulse bg-muted rounded" /></Card>;

  return (
    <div className="space-y-4">
      {message && (
        <div className={`p-3 rounded-md flex items-center gap-2 text-sm ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{users.length} users</p>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          {showForm ? <><X className="w-4 h-4 mr-1.5" />Cancel</> : <><UserPlus className="w-4 h-4 mr-1.5" />Add User</>}
        </Button>
      </div>

      {/* Add User Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold">Create New User</h3>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="newName"
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                required
              />
              <Input
                id="newEmail"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@company.com"
                required
              />
              <Input
                id="newPassword"
                label="Temporary Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters (user changes on first login)"
                required
                autoComplete="new-password"
              />
              <Select
                id="newRole"
                label="Role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                options={ROLE_OPTIONS}
              />
              <div className="sm:col-span-2">
                <Button type="submit" disabled={formLoading}>
                  {formLoading ? 'Creating...' : 'Create User'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* User Table */}
      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/50">
            <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Email</th>
            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Joined</th>
            <th className="text-left py-3 px-4 font-medium text-muted-foreground w-40">Actions</th>
          </tr></thead>
          <tbody>{users.map((u) => {
            const RoleIcon = ROLE_ICON[u.role] || User;
            const isSelf = u.id === currentUser?.id;
            const isSuperAdmin = u.role === 'SUPER_ADMIN';
            return (
              <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
                      <RoleIcon className="w-3.5 h-3.5 text-gibbs-primary" />
                    </div>
                    <span className="font-medium">{u.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-muted-foreground">{u.email}</td>
                <td className="py-3 px-4">
                  <Badge variant={ROLE_BADGE_VARIANT[u.role] || 'default'}>{ROLE_LABELS[u.role] || u.role}</Badge>
                </td>
                <td className="py-3 px-4 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="py-3 px-4">
                  {!isSelf && !isSuperAdmin && (
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value)}
                      className="h-8 rounded-md border border-input bg-card px-2 text-xs"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  )}
                  {isSuperAdmin && (
                    <span className="text-xs text-muted-foreground">Platform admin</span>
                  )}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
}
