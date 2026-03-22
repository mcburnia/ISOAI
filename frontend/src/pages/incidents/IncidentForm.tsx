import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import api from '../../api/client';

export default function IncidentForm() {
  const navigate = useNavigate();
  const [systems, setSystems] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    systemId: '', title: '', description: '',
    occurredAt: new Date().toISOString().split('T')[0], severity: '',
  });

  useEffect(() => { api.get('/systems').then((r) => setSystems(r.data.systems)); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/incidents', form);
      navigate('/incidents');
    } catch (err: any) { setError(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  const set = (f: string) => (e: any) => setForm({ ...form, [f]: e.target.value });

  return (
    <Card className="max-w-2xl">
      <CardHeader><h3 className="text-base font-semibold">Report Incident</h3></CardHeader>
      <CardContent>
        {error && <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input id="title" label="Incident Title" value={form.title} onChange={set('title')} required />
          <Select id="systemId" label="AI System" value={form.systemId} onChange={set('systemId')}
            options={systems.map((s) => ({ value: s.id, label: s.name }))} required />
          <Textarea id="description" label="Description" value={form.description} onChange={set('description')} required />
          <div className="grid grid-cols-2 gap-4">
            <Input id="occurredAt" label="Date Occurred" type="date" value={form.occurredAt} onChange={set('occurredAt')} required />
            <Select id="severity" label="Severity" value={form.severity} onChange={set('severity')}
              options={[{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }, { value: 'CRITICAL', label: 'Critical' }]} required />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}>{loading ? 'Reporting...' : 'Report Incident'}</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/incidents')}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
