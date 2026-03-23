import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import api from '../../api/client';
import { Plus, Check, SkipForward, Calendar, AlertTriangle } from 'lucide-react';

const OBLIGATION_TYPES = [
  { value: 'INTERNAL_AUDIT', label: 'Internal audit' },
  { value: 'MANAGEMENT_REVIEW', label: 'Management review' },
  { value: 'RISK_ASSESSMENT', label: 'Risk assessment review' },
  { value: 'AI_SYSTEM_REVIEW', label: 'AI system review' },
  { value: 'AI_IMPACT_ASSESSMENT', label: 'AI impact assessment' },
  { value: 'HUMAN_OVERSIGHT_REVIEW', label: 'Human oversight review' },
  { value: 'MONITORING_REVIEW', label: 'Monitoring review' },
  { value: 'DOCUMENT_REVIEW', label: 'Document/policy review' },
  { value: 'TRAINING_RENEWAL', label: 'Training renewal' },
  { value: 'CORRECTIVE_ACTION_FOLLOWUP', label: 'Corrective action follow-up' },
  { value: 'COMPETENCE_EVALUATION', label: 'Competence re-evaluation' },
];

const FREQUENCIES = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SEMI_ANNUAL', label: 'Semi-annual' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'CUSTOM_DAYS', label: 'Custom interval' },
];

const STANDARD_SHORT: Record<string, string> = {
  ISO_42001: 'ISO 42001', ISO_27001: 'ISO 27001', ISO_9001: 'ISO 9001',
  ISO_27701: 'ISO 27701', ISO_27017: 'ISO 27017', ISO_27018: 'ISO 27018',
  ISO_27002: 'ISO 27002', ISO_22301: 'ISO 22301', ISO_20000: 'ISO 20000-1',
  ISO_31000: 'ISO 31000', ISO_23894: 'ISO 23894', ISO_25024: 'ISO 25024',
  ISO_5338: 'ISO 5338', ISO_42005: 'ISO 42005',
};

const TYPE_SHORT: Record<string, string> = {
  INTERNAL_AUDIT: 'Audit', MANAGEMENT_REVIEW: 'Review',
  RISK_ASSESSMENT: 'Risk', AI_SYSTEM_REVIEW: 'AI Review',
  AI_IMPACT_ASSESSMENT: 'Impact', HUMAN_OVERSIGHT_REVIEW: 'Oversight',
  MONITORING_REVIEW: 'Monitoring', DOCUMENT_REVIEW: 'Document',
  TRAINING_RENEWAL: 'Training', CORRECTIVE_ACTION_FOLLOWUP: 'Corrective',
  COMPETENCE_EVALUATION: 'Competence',
};

interface Obligation {
  id: string;
  type: string;
  title: string;
  description: string | null;
  standardCode: string;
  clauseRef: string | null;
  frequency: string;
  customDays: number | null;
  anchorDate: string;
  assigneeId: string | null;
  assignee: { id: string; name: string } | null;
  status: string;
  latestInstance: { id: string; dueDate: string; status: string } | null;
  nextDueDate: string;
  daysUntilDue: number;
  frequencyLabel: string;
}

interface Summary {
  upcoming: number;
  overdue: number;
  completedThisMonth: number;
}

interface UserOption {
  id: string;
  name: string;
}

export default function SchedulingView() {
  const { isAdmin } = useAuth();
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [standards, setStandards] = useState<{ code: string }[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [standardFilter, setStandardFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Complete/skip modal state
  const [actionModal, setActionModal] = useState<{ instanceId: string; obligationTitle: string; action: 'complete' | 'skip' } | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Form state
  const [form, setForm] = useState({
    type: '', title: '', description: '', standardCode: '',
    clauseRef: '', frequency: 'ANNUAL', customDays: '',
    anchorDate: '', assigneeId: '',
  });

  const load = async () => {
    try {
      const params: any = {};
      if (standardFilter) params.standardCode = standardFilter;
      const [obRes, sumRes, stdRes, usrRes] = await Promise.all([
        api.get('/scheduling/obligations', { params }),
        api.get('/scheduling/summary'),
        api.get('/compliance/standards'),
        api.get('/users'),
      ]);
      setObligations(obRes.data.obligations);
      setSummary(sumRes.data);
      setStandards(stdRes.data.standards.map((s: string) => ({ code: s })));
      setUsers(usrRes.data.users.map((u: any) => ({ id: u.id, name: u.name })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [standardFilter]);

  const filtered = obligations.filter((ob) => {
    if (filter === 'upcoming') return ob.daysUntilDue <= 30 && ob.daysUntilDue > 0 && ob.status === 'ACTIVE';
    if (filter === 'overdue') return ob.daysUntilDue <= 0 && ob.status === 'ACTIVE';
    if (filter === 'paused') return ob.status === 'PAUSED';
    return true;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      await api.post('/scheduling/obligations', {
        ...form,
        customDays: form.frequency === 'CUSTOM_DAYS' ? parseInt(form.customDays) : undefined,
        assigneeId: form.assigneeId || undefined,
        description: form.description || undefined,
        clauseRef: form.clauseRef || undefined,
      });
      setShowForm(false);
      setForm({ type: '', title: '', description: '', standardCode: '', clauseRef: '', frequency: 'ANNUAL', customDays: '', anchorDate: '', assigneeId: '' });
      setMessage({ type: 'success', text: 'Obligation created' });
      load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to create obligation' });
    }
  };

  const handleAction = async () => {
    if (!actionModal) return;
    setActionLoading(true);
    try {
      await api.post(`/scheduling/instances/${actionModal.instanceId}/${actionModal.action}`, {
        notes: actionNotes || undefined,
      });
      setActionModal(null);
      setActionNotes('');
      setMessage({ type: 'success', text: `Obligation ${actionModal.action === 'complete' ? 'completed' : 'skipped'}` });
      load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Action failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const toggleStatus = async (ob: Obligation) => {
    const newStatus = ob.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await api.patch(`/scheduling/obligations/${ob.id}`, { status: newStatus });
      setMessage({ type: 'success', text: `Obligation ${newStatus === 'ACTIVE' ? 'activated' : 'paused'}` });
      load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Update failed' });
    }
  };

  const dueBadge = (days: number, status: string) => {
    if (status === 'PAUSED') return <Badge variant="default">Paused</Badge>;
    if (days <= 0) return <Badge variant="error">Overdue</Badge>;
    if (days <= 7) return <Badge variant="error">Due in {days}d</Badge>;
    if (days <= 30) return <Badge variant="warning">Due in {days}d</Badge>;
    return <Badge variant="success">Due in {days}d</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}><CardContent className="h-20 animate-pulse bg-muted rounded" /></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="p-2 rounded-lg bg-amber-50">
                <Calendar className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{summary.upcoming}</p>
                <p className="text-xs text-muted-foreground">Due within 30 days</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="p-2 rounded-lg bg-red-50">
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{summary.overdue}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="p-2 rounded-lg bg-emerald-50">
                <Check className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{summary.completedThisMonth}</p>
                <p className="text-xs text-muted-foreground">Completed this month</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and create */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2">
          {['all', 'upcoming', 'overdue', 'paused'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-gibbs-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {standards.length > 0 && (
            <select
              value={standardFilter}
              onChange={(e) => setStandardFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-card px-2 text-xs"
            >
              <option value="">All standards</option>
              {standards.map((s) => (
                <option key={s.code} value={s.code}>{STANDARD_SHORT[s.code] || s.code}</option>
              ))}
            </select>
          )}
          {isAdmin && (
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> New obligation
            </Button>
          )}
        </div>
      </div>

      {/* Create form */}
      {showForm && isAdmin && (
        <Card>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select id="type" label="Obligation type" options={OBLIGATION_TYPES}
                  value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required />
                <Input id="title" label="Title" value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select id="standardCode" label="Standard"
                  options={standards.map((s) => ({ value: s.code, label: STANDARD_SHORT[s.code] || s.code }))}
                  value={form.standardCode} onChange={(e) => setForm({ ...form, standardCode: e.target.value })} required />
                <Input id="clauseRef" label="Clause reference" placeholder="e.g. 9.2"
                  value={form.clauseRef} onChange={(e) => setForm({ ...form, clauseRef: e.target.value })} />
                <Select id="frequency" label="Frequency" options={FREQUENCIES}
                  value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} required />
              </div>
              {form.frequency === 'CUSTOM_DAYS' && (
                <Input id="customDays" label="Custom interval (days)" type="number"
                  value={form.customDays} onChange={(e) => setForm({ ...form, customDays: e.target.value })} required />
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input id="anchorDate" label="First due date" type="date"
                  value={form.anchorDate} onChange={(e) => setForm({ ...form, anchorDate: e.target.value })} required />
                <Select id="assigneeId" label="Assignee (optional)"
                  options={users.map((u) => ({ value: u.id, label: u.name }))}
                  value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })} />
              </div>
              <Textarea id="description" label="Description (optional)" rows={2}
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <div className="flex gap-2">
                <Button type="submit">Create obligation</Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Obligation list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {obligations.length === 0
                ? 'No obligations scheduled yet. Activate a standard to generate default obligations, or create one manually.'
                : 'No obligations match the current filter.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((ob) => (
            <Card key={ob.id}>
              <CardContent className="flex items-center gap-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-foreground truncate">{ob.title}</span>
                    <Badge variant="purple">{TYPE_SHORT[ob.type] || ob.type}</Badge>
                    <Badge variant="info">{STANDARD_SHORT[ob.standardCode] || ob.standardCode}</Badge>
                    {ob.clauseRef && (
                      <span className="text-[10px] text-muted-foreground">Clause {ob.clauseRef}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{ob.frequencyLabel}</span>
                    {ob.assignee && <span>Assigned to {ob.assignee.name}</span>}
                    <span>Next: {new Date(ob.nextDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {dueBadge(ob.daysUntilDue, ob.status)}
                  {ob.status === 'ACTIVE' && ob.latestInstance && ob.latestInstance.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => setActionModal({ instanceId: ob.latestInstance!.id, obligationTitle: ob.title, action: 'complete' })}
                        className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600 transition-colors"
                        title="Mark complete"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => setActionModal({ instanceId: ob.latestInstance!.id, obligationTitle: ob.title, action: 'skip' })}
                          className="p-1.5 rounded hover:bg-amber-50 text-amber-600 transition-colors"
                          title="Skip"
                        >
                          <SkipForward className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => toggleStatus(ob)}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {ob.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Complete/Skip modal */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="space-y-4">
              <h3 className="text-lg font-semibold">
                {actionModal.action === 'complete' ? 'Complete' : 'Skip'} obligation
              </h3>
              <p className="text-sm text-muted-foreground">{actionModal.obligationTitle}</p>
              <Textarea
                id="actionNotes"
                label={actionModal.action === 'skip' ? 'Reason for skipping (required)' : 'Notes (optional)'}
                rows={3}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                required={actionModal.action === 'skip'}
              />
              <div className="flex gap-2">
                <Button onClick={handleAction} disabled={actionLoading || (actionModal.action === 'skip' && !actionNotes.trim())}>
                  {actionLoading ? 'Saving...' : actionModal.action === 'complete' ? 'Mark complete' : 'Skip'}
                </Button>
                <Button variant="secondary" onClick={() => { setActionModal(null); setActionNotes(''); }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
