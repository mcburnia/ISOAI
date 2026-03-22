import { useEffect, useState, FormEvent } from 'react';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import api from '../../api/client';
import { Eye, Plus } from 'lucide-react';

interface Record { id: string; reviewDate: string; reviewType: string; findings: string; concernsRaised: boolean; escalated: boolean; system: { name: string }; reviewer: { name: string }; }

export default function OversightList() {
  const [records, setRecords] = useState<Record[]>([]);
  const [systems, setSystems] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ systemId: '', reviewDate: new Date().toISOString().split('T')[0], reviewType: '', findings: '', concernsRaised: false, escalated: false });
  const [loading, setLoading] = useState(true);

  const load = () => api.get('/oversight').then((r) => setRecords(r.data.records));
  useEffect(() => { Promise.all([load(), api.get('/systems').then((r) => setSystems(r.data.systems))]).finally(() => setLoading(false)); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/oversight', form);
    setShowForm(false);
    setForm({ systemId: '', reviewDate: new Date().toISOString().split('T')[0], reviewType: '', findings: '', concernsRaised: false, escalated: false });
    load();
  };

  const set = (f: string) => (e: any) => setForm({ ...form, [f]: e.target.value });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{records.length} oversight records</p>
        <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="w-4 h-4" /> Add Record</Button>
      </div>

      {showForm && (
        <Card><CardHeader><h3 className="text-sm font-semibold">New Oversight Record</h3></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Select id="systemId" label="System" value={form.systemId} onChange={set('systemId')} options={systems.map((s) => ({ value: s.id, label: s.name }))} required />
              <Input id="reviewDate" label="Review Date" type="date" value={form.reviewDate} onChange={set('reviewDate')} required />
              <Select id="reviewType" label="Review Type" value={form.reviewType} onChange={set('reviewType')}
                options={[{ value: 'OUTPUT_REVIEW', label: 'Output Review' }, { value: 'OPERATIONAL_OBSERVATION', label: 'Operational Observation' }, { value: 'PERIODIC_REVIEW', label: 'Periodic Review' }]} required />
            </div>
            <Textarea id="findings" label="Findings" value={form.findings} onChange={set('findings')} required />
            <div className="flex gap-3">
              <Button type="submit" size="sm">Save</Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </CardContent></Card>
      )}

      {loading ? <Card><div className="h-32 animate-pulse bg-muted rounded" /></Card>
      : records.length === 0 ? (
        <Card><div className="py-12 text-center"><Eye className="w-10 h-10 text-muted-foreground mx-auto mb-3" /><p className="text-sm text-muted-foreground">No oversight records</p></div></Card>
      ) : (
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">System</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Reviewer</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Findings</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Flags</th>
            </tr></thead>
            <tbody>{records.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="py-3 px-4 text-muted-foreground">{new Date(r.reviewDate).toLocaleDateString()}</td>
                <td className="py-3 px-4">{r.system.name}</td>
                <td className="py-3 px-4"><Badge>{r.reviewType.replace(/_/g, ' ')}</Badge></td>
                <td className="py-3 px-4 text-muted-foreground">{r.reviewer.name}</td>
                <td className="py-3 px-4 text-muted-foreground line-clamp-1 max-w-xs">{r.findings}</td>
                <td className="py-3 px-4">
                  {r.concernsRaised && <Badge variant="warning">Concerns</Badge>}
                  {r.escalated && <Badge variant="error">Escalated</Badge>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
