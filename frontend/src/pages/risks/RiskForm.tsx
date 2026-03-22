import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import Input from '../../components/ui/Input';
import api from '../../api/client';

export default function RiskForm() {
  const navigate = useNavigate();
  const [systems, setSystems] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    systemId: '', description: '', category: '',
    likelihood: '', impact: '', riskRating: '',
    mitigationMeasures: '', ownerId: '', reviewDate: '',
  });

  useEffect(() => {
    Promise.all([api.get('/systems'), api.get('/users')]).then(([s, u]) => {
      setSystems(s.data.systems);
      setUsers(u.data.users);
    });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/risks', form);
      navigate('/risks');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create risk');
    } finally {
      setLoading(false);
    }
  };

  const set = (field: string) => (e: any) => setForm({ ...form, [field]: e.target.value });

  return (
    <Card className="max-w-2xl">
      <CardHeader><h3 className="text-base font-semibold">Record New Risk</h3></CardHeader>
      <CardContent>
        {error && <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select id="systemId" label="AI System" value={form.systemId} onChange={set('systemId')}
            options={systems.map((s) => ({ value: s.id, label: s.name }))} required />
          <Textarea id="description" label="Risk Description" value={form.description} onChange={set('description')} required
            placeholder="Describe what could go wrong, how it might arise, and potential consequences..." />
          <Select id="category" label="Risk Category" value={form.category} onChange={set('category')}
            options={[
              { value: 'REGULATORY', label: 'Regulatory' },
              { value: 'OPERATIONAL', label: 'Operational' },
              { value: 'DATA', label: 'Data' },
              { value: 'BIAS_FAIRNESS', label: 'Bias & Fairness' },
              { value: 'SECURITY', label: 'Security' },
              { value: 'MISUSE', label: 'Misuse' },
            ]} required />
          <div className="grid grid-cols-3 gap-4">
            <Select id="likelihood" label="Likelihood" value={form.likelihood} onChange={set('likelihood')}
              options={[{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }]} required />
            <Select id="impact" label="Impact" value={form.impact} onChange={set('impact')}
              options={[{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }]} required />
            <Select id="riskRating" label="Risk Rating" value={form.riskRating} onChange={set('riskRating')}
              options={[{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }, { value: 'CRITICAL', label: 'Critical' }]} required />
          </div>
          <Textarea id="mitigationMeasures" label="Mitigation Measures" value={form.mitigationMeasures} onChange={set('mitigationMeasures')} required />
          <div className="grid grid-cols-2 gap-4">
            <Select id="ownerId" label="Risk Owner" value={form.ownerId} onChange={set('ownerId')}
              options={users.map((u) => ({ value: u.id, label: u.name }))} required />
            <Input id="reviewDate" label="Review Date" type="date" value={form.reviewDate} onChange={set('reviewDate')} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Record Risk'}</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/risks')}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
