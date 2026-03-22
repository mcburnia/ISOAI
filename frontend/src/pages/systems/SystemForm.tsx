import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import api from '../../api/client';

interface User {
  id: string;
  name: string;
}

export default function SystemForm() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', description: '', ownerId: '',
    environment: '', systemType: '',
    riskClassification: '', humanOversight: '',
    deploymentStatus: 'DEVELOPMENT',
  });

  useEffect(() => {
    api.get('/users').then((res) => setUsers(res.data.users));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/systems', form);
      navigate('/systems');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create system');
    } finally {
      setLoading(false);
    }
  };

  const set = (field: string) => (e: any) => setForm({ ...form, [field]: e.target.value });

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <h3 className="text-base font-semibold">Register New AI System</h3>
      </CardHeader>
      <CardContent>
        {error && <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input id="name" label="System Name" value={form.name} onChange={set('name')} required />
          <Textarea id="description" label="Description" value={form.description} onChange={set('description')} required />
          <Select
            id="ownerId" label="System Owner" value={form.ownerId} onChange={set('ownerId')}
            options={users.map((u) => ({ value: u.id, label: u.name }))} required
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              id="environment" label="Environment" value={form.environment} onChange={set('environment')}
              options={[
                { value: 'RESEARCH', label: 'Research' },
                { value: 'DEVELOPMENT', label: 'Development' },
                { value: 'INTERNAL_ANALYSIS', label: 'Internal Analysis' },
                { value: 'PRODUCTION', label: 'Production' },
                { value: 'CONSULTING', label: 'Consulting' },
              ]} required
            />
            <Select
              id="systemType" label="System Type" value={form.systemType} onChange={set('systemType')}
              options={[
                { value: 'ML_MODEL', label: 'ML Model' },
                { value: 'LLM_APPLICATION', label: 'LLM Application' },
                { value: 'ANALYTICAL_TOOL', label: 'Analytical Tool' },
                { value: 'DECISION_SUPPORT', label: 'Decision Support' },
                { value: 'AGENT_AUTOMATION', label: 'Agent Automation' },
              ]} required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              id="riskClassification" label="Risk Classification" value={form.riskClassification} onChange={set('riskClassification')}
              options={[
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' },
              ]} required
            />
            <Select
              id="deploymentStatus" label="Deployment Status" value={form.deploymentStatus} onChange={set('deploymentStatus')}
              options={[
                { value: 'DEVELOPMENT', label: 'Development' },
                { value: 'TESTING', label: 'Testing' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'SUSPENDED', label: 'Suspended' },
                { value: 'RETIRED', label: 'Retired' },
              ]} required
            />
          </div>
          <Textarea id="humanOversight" label="Human Oversight Arrangement" value={form.humanOversight} onChange={set('humanOversight')} required placeholder="Describe how human oversight is maintained for this system..." />
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Register System'}</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/systems')}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
