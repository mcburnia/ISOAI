import { useEffect, useState, FormEvent } from 'react';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { ClipboardCheck, Plus } from 'lucide-react';

interface Audit { id: string; title: string; date: string; scope: string; status: string; findings: { id: string; finding: string; severity: string; status: string }[]; }

const statVariant = (s: string) => ({ PLANNED: 'info', IN_PROGRESS: 'warning', COMPLETED: 'success' }[s] || 'default') as any;

export default function AuditList() {
  const { canWrite } = useAuth();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', date: new Date().toISOString().split('T')[0], scope: '' });
  const [loading, setLoading] = useState(true);

  const load = () => api.get('/audits').then((r) => setAudits(r.data.audits));
  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/audits', form);
    setShowForm(false);
    setForm({ title: '', date: new Date().toISOString().split('T')[0], scope: '' });
    load();
  };

  const set = (f: string) => (e: any) => setForm({ ...form, [f]: e.target.value });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{audits.length} audits</p>
        {canWrite && <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="w-4 h-4" /> New Audit</Button>}
      </div>

      {showForm && (
        <Card><CardHeader><h3 className="text-sm font-semibold">Create Audit</h3></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input id="title" label="Audit Title" value={form.title} onChange={set('title')} required />
            <div className="grid grid-cols-2 gap-3">
              <Input id="date" label="Date" type="date" value={form.date} onChange={set('date')} required />
            </div>
            <Textarea id="scope" label="Scope" value={form.scope} onChange={set('scope')} required />
            <div className="flex gap-3"><Button type="submit" size="sm">Create</Button><Button type="button" size="sm" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button></div>
          </form>
        </CardContent></Card>
      )}

      {loading ? <Card><div className="h-32 animate-pulse bg-muted rounded" /></Card>
      : audits.length === 0 ? (
        <Card><div className="py-12 text-center"><ClipboardCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" /><p className="text-sm text-muted-foreground">No audits scheduled</p></div></Card>
      ) : (
        <div className="space-y-3">
          {audits.map((a) => (
            <Card key={a.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{a.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(a.date).toLocaleDateString()} &middot; {a.scope}</p>
                  </div>
                  <Badge variant={statVariant(a.status)}>{a.status}</Badge>
                </div>
                {a.findings.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">{a.findings.length} finding(s)</p>
                    {a.findings.map((f) => (
                      <div key={f.id} className="flex items-center justify-between text-xs py-1">
                        <span className="text-foreground">{f.finding}</span>
                        <div className="flex gap-1.5">
                          <Badge variant={f.severity === 'HIGH' ? 'error' : f.severity === 'MEDIUM' ? 'warning' : 'default'}>{f.severity}</Badge>
                          <Badge variant={f.status === 'CLOSED' ? 'success' : 'info'}>{f.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
