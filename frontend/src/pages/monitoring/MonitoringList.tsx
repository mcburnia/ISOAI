import { useEffect, useState, FormEvent } from 'react';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import api from '../../api/client';
import { Activity, Plus } from 'lucide-react';

interface Record { id: string; date: string; type: string; findings: string; performanceStatus: string; system: { name: string }; reviewer: { name: string }; }

const perfVariant = (s: string) => ({ SATISFACTORY: 'success', CONCERNS_IDENTIFIED: 'warning', ACTION_REQUIRED: 'error' }[s] || 'default') as any;

export default function MonitoringList() {
  const [records, setRecords] = useState<Record[]>([]);
  const [systems, setSystems] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ systemId: '', date: new Date().toISOString().split('T')[0], type: '', findings: '', performanceStatus: '', followUpActions: '' });
  const [loading, setLoading] = useState(true);

  const load = () => api.get('/monitoring').then((r) => setRecords(r.data.records));
  useEffect(() => { Promise.all([load(), api.get('/systems').then((r) => setSystems(r.data.systems))]).finally(() => setLoading(false)); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/monitoring', form);
    setShowForm(false);
    load();
  };

  const set = (f: string) => (e: any) => setForm({ ...form, [f]: e.target.value });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{records.length} monitoring records</p>
        <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="w-4 h-4" /> Add Record</Button>
      </div>

      {showForm && (
        <Card><CardHeader><h3 className="text-sm font-semibold">New Monitoring Record</h3></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Select id="systemId" label="System" value={form.systemId} onChange={set('systemId')} options={systems.map((s) => ({ value: s.id, label: s.name }))} required />
              <Input id="date" label="Date" type="date" value={form.date} onChange={set('date')} required />
              <Select id="type" label="Type" value={form.type} onChange={set('type')}
                options={[{ value: 'OUTPUT_REVIEW', label: 'Output Review' }, { value: 'OPERATIONAL_OBSERVATION', label: 'Operational Observation' }, { value: 'DATA_REVIEW', label: 'Data Review' }, { value: 'CONTEXT_REVIEW', label: 'Context Review' }]} required />
            </div>
            <Textarea id="findings" label="Findings" value={form.findings} onChange={set('findings')} required />
            <div className="grid grid-cols-2 gap-3">
              <Select id="performanceStatus" label="Performance Status" value={form.performanceStatus} onChange={set('performanceStatus')}
                options={[{ value: 'SATISFACTORY', label: 'Satisfactory' }, { value: 'CONCERNS_IDENTIFIED', label: 'Concerns Identified' }, { value: 'ACTION_REQUIRED', label: 'Action Required' }]} required />
              <Textarea id="followUpActions" label="Follow-up Actions" value={form.followUpActions} onChange={set('followUpActions')} />
            </div>
            <div className="flex gap-3"><Button type="submit" size="sm">Save</Button><Button type="button" size="sm" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button></div>
          </form>
        </CardContent></Card>
      )}

      {loading ? <Card><div className="h-32 animate-pulse bg-muted rounded" /></Card>
      : records.length === 0 ? (
        <Card><div className="py-12 text-center"><Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3" /><p className="text-sm text-muted-foreground">No monitoring records</p></div></Card>
      ) : (
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">System</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Findings</th>
            </tr></thead>
            <tbody>{records.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="py-3 px-4 text-muted-foreground">{new Date(r.date).toLocaleDateString()}</td>
                <td className="py-3 px-4">{r.system.name}</td>
                <td className="py-3 px-4"><Badge>{r.type.replace(/_/g, ' ')}</Badge></td>
                <td className="py-3 px-4"><Badge variant={perfVariant(r.performanceStatus)}>{r.performanceStatus.replace(/_/g, ' ')}</Badge></td>
                <td className="py-3 px-4 text-muted-foreground line-clamp-1 max-w-xs">{r.findings}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
