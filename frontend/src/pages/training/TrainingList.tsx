import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { GraduationCap, Plus, Clock, BookOpen, ChevronRight, CheckCircle } from 'lucide-react';

interface Record {
  id: string;
  topic: string;
  completedAt: string;
  evidence: string | null;
  acknowledged: boolean;
  user: { name: string; email: string };
  module: { slug: string; title: string } | null;
}

interface Module {
  id: string;
  slug: string;
  title: string;
  description: string;
  standardCode?: string;
  durationMinutes: number;
  _count: { completions: number };
}

const STANDARD_SHORT: Record<string, string> = {
  ISO_42001: 'ISO 42001',
  ISO_27001: 'ISO 27001',
  ISO_9001: 'ISO 9001',
  ISO_27701: 'ISO 27701',
  ISO_27017: 'ISO 27017',
  ISO_27018: 'ISO 27018',
  ISO_27002: 'ISO 27002',
  ISO_22301: 'ISO 22301',
  ISO_20000: 'ISO 20000-1',
  ISO_31000: 'ISO 31000',
  ISO_23894: 'ISO 23894',
  ISO_25024: 'ISO 25024',
  ISO_5338: 'ISO 5338',
  ISO_42005: 'ISO 42005',
};

export default function TrainingList() {
  const { isAdmin, user } = useAuth();
  const [records, setRecords] = useState<Record[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ userId: '', topic: '', completedAt: new Date().toISOString().split('T')[0], evidence: '', acknowledged: true });
  const [loading, setLoading] = useState(true);
  const [selectedStandard, setSelectedStandard] = useState<string>('ALL');

  const load = () => Promise.all([
    api.get('/training', { params: isAdmin ? {} : { userId: user?.id } }).then((r) => setRecords(r.data.records)),
    api.get('/training/modules').then((r) => setModules(r.data.modules)),
  ]);

  useEffect(() => {
    Promise.all([load(), api.get('/users').then((r) => setUsers(r.data.users))]).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/training', form);
    setShowForm(false);
    load();
  };

  const set = (f: string) => (e: any) => setForm({ ...form, [f]: e.target.value });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted rounded animate-pulse" />
        <div className="h-48 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  // Get unique standard codes from modules
  const standardCodes = [...new Set(modules.map((m) => m.standardCode || 'OTHER'))].sort();
  const filteredModules = selectedStandard === 'ALL'
    ? modules
    : modules.filter((m) => (m.standardCode || 'OTHER') === selectedStandard);

  // Group modules by standard
  const groupedModules = filteredModules.reduce((acc, mod) => {
    const code = mod.standardCode || 'OTHER';
    if (!acc[code]) acc[code] = [];
    acc[code].push(mod);
    return acc;
  }, {} as Record<string, Module[]>);

  return (
    <div className="space-y-6">
      {/* Available Training Modules */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Available Training</h3>
          <span className="text-xs text-muted-foreground">{modules.length} modules across {standardCodes.length} standards</span>
        </div>

        {/* Standard filter pills */}
        {standardCodes.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              onClick={() => setSelectedStandard('ALL')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedStandard === 'ALL'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              All ({modules.length})
            </button>
            {standardCodes.map((code) => (
              <button
                key={code}
                onClick={() => setSelectedStandard(code)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedStandard === code
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
              >
                {STANDARD_SHORT[code] || code} ({modules.filter((m) => (m.standardCode || 'OTHER') === code).length})
              </button>
            ))}
          </div>
        )}

        {Object.entries(groupedModules)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([code, mods]) => (
          <div key={code} className="mb-4">
            {selectedStandard === 'ALL' && (
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                {STANDARD_SHORT[code] || code}
              </h4>
            )}
            <div className="space-y-3">
              {mods.map((mod) => (
                <Link
                  key={mod.id}
                  to={`/training/modules/${mod.slug}`}
                  className="block bg-white rounded-lg border border-border hover:border-primary/30 hover:shadow-sm transition-all p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-5 h-5 text-gibbs-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-foreground">{mod.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{mod.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <Badge variant="default"><Clock className="w-3 h-3 mr-1" />{mod.durationMinutes} min</Badge>
                        <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" />{mod._count.completions} completed</Badge>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
        {filteredModules.length === 0 && (
          <Card>
            <div className="py-8 text-center">
              <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">No training modules available</p>
            </div>
          </Card>
        )}
      </div>

      {/* Training Record Register */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">{isAdmin ? 'Training Record Register' : 'My Training Records'}</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{records.length} records</span>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
                <Plus className="w-4 h-4" /> Manual Entry
              </Button>
            )}
          </div>
        </div>

        {showForm && (
          <Card className="mb-3">
            <CardHeader><h3 className="text-sm font-semibold">New Training Record</h3></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Select id="userId" label="Person" value={form.userId} onChange={set('userId')} options={users.map((u) => ({ value: u.id, label: u.name }))} required />
                  <Input id="completedAt" label="Completed Date" type="date" value={form.completedAt} onChange={set('completedAt')} required />
                </div>
                <Input id="topic" label="Training Topic" value={form.topic} onChange={set('topic')} required />
                <Textarea id="evidence" label="Evidence / Notes" value={form.evidence} onChange={set('evidence')} />
                <div className="flex gap-3">
                  <Button type="submit" size="sm">Save</Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {records.length === 0 ? (
          <Card>
            <div className="py-12 text-center">
              <GraduationCap className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">No training records yet</p>
              <p className="text-xs text-muted-foreground mt-1">{isAdmin ? 'Records will appear here when staff complete training modules' : 'Complete a training module above to get started'}</p>
            </div>
          </Card>
        ) : (
          <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {isAdmin && <th className="text-left py-3 px-4 font-medium text-muted-foreground">Person</th>}
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Training</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Completed</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    {isAdmin && <td className="py-3 px-4 font-medium">{r.user.name}</td>}
                    <td className="py-3 px-4 text-muted-foreground">
                      {r.module ? (
                        <Link to={`/training/modules/${r.module.slug}`} className="text-primary hover:underline">
                          {r.topic}
                        </Link>
                      ) : r.topic}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{new Date(r.completedAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <Badge variant={r.acknowledged ? 'success' : 'warning'}>
                        {r.acknowledged ? 'Acknowledged' : 'Pending'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground max-w-48 truncate">{r.evidence || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
