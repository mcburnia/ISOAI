import { useEffect, useState, FormEvent } from 'react';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Users, Plus, Trash2 } from 'lucide-react';

interface GovRole { id: string; role: string; assignedAt: string; user: { id: string; name: string; email: string }; system: { id: string; name: string } | null; }

const roleLabels: Record<string, string> = {
  AI_GOVERNANCE_LEAD: 'AI Governance Lead',
  TECHNICAL_ARCHITECTURE_LEAD: 'Technical Architecture Lead',
  DATA_GOVERNANCE_LEAD: 'Data Governance Lead',
  AI_SYSTEM_OWNER: 'AI System Owner',
  OPERATIONAL_REVIEWER: 'Operational Reviewer',
};

export default function RolesList() {
  const { isAdmin } = useAuth();
  const [roles, setRoles] = useState<GovRole[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [systems, setSystems] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ userId: '', role: '', systemId: '' });
  const [loading, setLoading] = useState(true);

  const load = () => api.get('/governance-roles').then((r) => setRoles(r.data.roles));
  useEffect(() => {
    Promise.all([load(), api.get('/users').then((r) => setUsers(r.data.users)), api.get('/systems').then((r) => setSystems(r.data.systems))])
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const data: any = { userId: form.userId, role: form.role };
    if (form.systemId) data.systemId = form.systemId;
    await api.post('/governance-roles', data);
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => { await api.delete(`/governance-roles/${id}`); load(); };
  const set = (f: string) => (e: any) => setForm({ ...form, [f]: e.target.value });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{roles.length} role assignments</p>
        {isAdmin && <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="w-4 h-4" /> Assign Role</Button>}
      </div>

      {showForm && (
        <Card><CardHeader><h3 className="text-sm font-semibold">Assign Governance Role</h3></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Select id="userId" label="Person" value={form.userId} onChange={set('userId')} options={users.map((u) => ({ value: u.id, label: u.name }))} required />
              <Select id="role" label="Governance Role" value={form.role} onChange={set('role')}
                options={Object.entries(roleLabels).map(([v, l]) => ({ value: v, label: l }))} required />
              <Select id="systemId" label="System (optional)" value={form.systemId} onChange={set('systemId')}
                options={systems.map((s) => ({ value: s.id, label: s.name }))} />
            </div>
            <div className="flex gap-3"><Button type="submit" size="sm">Assign</Button><Button type="button" size="sm" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button></div>
          </form>
        </CardContent></Card>
      )}

      {loading ? <Card><div className="h-32 animate-pulse bg-muted rounded" /></Card>
      : roles.length === 0 ? (
        <Card><div className="py-12 text-center"><Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" /><p className="text-sm text-muted-foreground">No governance roles assigned</p></div></Card>
      ) : (
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Person</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">System</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Since</th>
              {isAdmin && <th className="text-left py-3 px-4 font-medium text-muted-foreground w-12"></th>}
            </tr></thead>
            <tbody>{roles.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="py-3 px-4 font-medium">{r.user.name}</td>
                <td className="py-3 px-4"><Badge variant="purple">{roleLabels[r.role] || r.role}</Badge></td>
                <td className="py-3 px-4 text-muted-foreground">{r.system?.name || 'Organisation-wide'}</td>
                <td className="py-3 px-4 text-muted-foreground">{new Date(r.assignedAt).toLocaleDateString()}</td>
                {isAdmin && <td className="py-3 px-4"><button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button></td>}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
