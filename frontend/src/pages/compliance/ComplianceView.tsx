import { useEffect, useState } from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import api from '../../api/client';
import { CheckCircle, ChevronDown, ChevronRight, Shield, Filter } from 'lucide-react';

interface Mapping {
  id: string;
  standardCode: string;
  clauseNumber: string;
  clauseTitle: string;
  requirement: string;
  evidenceDescription: string | null;
  status: string;
  linkedDocuments: string | null;
  harmonizedGroupId: string | null;
}

const STANDARD_LABELS: Record<string, string> = {
  ISO_42001: 'ISO 42001 — AI Management System',
  ISO_27001: 'ISO 27001 — Information Security',
  ISO_9001: 'ISO 9001 — Quality Management',
  ISO_27701: 'ISO 27701 — Privacy Information',
  ISO_27017: 'ISO 27017 — Cloud Security',
  ISO_27018: 'ISO 27018 — Cloud Privacy',
  ISO_27002: 'ISO 27002 — Security Controls',
  ISO_22301: 'ISO 22301 — Business Continuity',
  ISO_20000: 'ISO 20000-1 — IT Service Management',
  ISO_31000: 'ISO 31000 — Risk Management',
  ISO_23894: 'ISO 23894 — AI Risk Management',
  ISO_25024: 'ISO 25024 — Data Quality',
  ISO_5338: 'ISO 5338 — AI Lifecycle',
  ISO_42005: 'ISO 42005 — AI Impact Assessment',
};

const SHORT_LABELS: Record<string, string> = {
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

const statusVariant = (s: string) =>
  ({ COMPLIANT: 'success', PARTIAL: 'warning', NOT_STARTED: 'default' }[s] || 'default') as any;

const CLAUSE_SECTION_TITLES: Record<string, string> = {
  '4': 'Context of the Organisation',
  '5': 'Leadership',
  '6': 'Planning',
  '7': 'Support',
  '8': 'Operation',
  '9': 'Performance Evaluation',
  '10': 'Improvement',
  A: 'Annex A Controls',
};

export default function ComplianceView() {
  const [standards, setStandards] = useState<string[]>([]);
  const [selectedStandard, setSelectedStandard] = useState<string>('');
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ status: '', evidenceDescription: '', linkedDocuments: '' });
  const [loading, setLoading] = useState(true);
  const [collapsedClauses, setCollapsedClauses] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    api.get('/compliance/standards').then((r) => {
      const stds: string[] = r.data.standards;
      setStandards(stds);
      if (stds.length > 0) {
        const defaultStd = stds.includes('ISO_42001') ? 'ISO_42001' : stds[0];
        setSelectedStandard(defaultStd);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedStandard) return;
    setLoading(true);
    api
      .get('/compliance', { params: { standardCode: selectedStandard } })
      .then((r) => setMappings(r.data.mappings))
      .finally(() => setLoading(false));
  }, [selectedStandard]);

  const startEdit = (m: Mapping) => {
    setEditing(m.id);
    setEditForm({
      status: m.status,
      evidenceDescription: m.evidenceDescription || '',
      linkedDocuments: m.linkedDocuments || '',
    });
  };

  const save = async () => {
    if (!editing) return;
    await api.patch(`/compliance/${editing}`, editForm);
    setEditing(null);
    const r = await api.get('/compliance', { params: { standardCode: selectedStandard } });
    setMappings(r.data.mappings);
  };

  const toggleClause = (clause: string) => {
    setCollapsedClauses((prev) => {
      const next = new Set(prev);
      if (next.has(clause)) next.delete(clause);
      else next.add(clause);
      return next;
    });
  };

  const filteredMappings = statusFilter === 'ALL' ? mappings : mappings.filter((m) => m.status === statusFilter);

  const compliant = mappings.filter((m) => m.status === 'COMPLIANT').length;
  const partial = mappings.filter((m) => m.status === 'PARTIAL').length;
  const notStarted = mappings.filter((m) => m.status === 'NOT_STARTED').length;
  const pct = mappings.length ? Math.round((compliant / mappings.length) * 100) : 0;

  const grouped = filteredMappings.reduce(
    (acc, m) => {
      const parts = m.clauseNumber.split('.');
      const clause = parts[0];
      if (!acc[clause]) acc[clause] = [];
      acc[clause].push(m);
      return acc;
    },
    {} as Record<string, Mapping[]>
  );

  if (loading && standards.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-16 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Standard Selector Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {standards.map((code) => (
          <button
            key={code}
            onClick={() => {
              setSelectedStandard(code);
              setStatusFilter('ALL');
              setCollapsedClauses(new Set());
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedStandard === code
                ? 'bg-primary text-white shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            {SHORT_LABELS[code] || code.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Standard Title + Progress Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-green-50">
              <Shield className="w-5 h-5 text-gibbs-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-foreground mb-1">
                {STANDARD_LABELS[selectedStandard] || selectedStandard}
              </h2>
              <div className="flex items-center gap-3 mb-1.5">
                <div className="flex-1">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold text-foreground">{pct}%</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  <span className="font-medium text-emerald-600">{compliant}</span> Compliant
                </span>
                <span>
                  <span className="font-medium text-amber-600">{partial}</span> Partial
                </span>
                <span>
                  <span className="font-medium text-slate-400">{notStarted}</span> Not Started
                </span>
                <span>{mappings.length} total controls</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Filter Bar */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        {['ALL', 'NOT_STARTED', 'PARTIAL', 'COMPLIANT'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              statusFilter === s
                ? s === 'COMPLIANT'
                  ? 'bg-emerald-100 text-emerald-700'
                  : s === 'PARTIAL'
                    ? 'bg-amber-100 text-amber-700'
                    : s === 'NOT_STARTED'
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {s === 'ALL'
              ? `All (${mappings.length})`
              : s === 'COMPLIANT'
                ? `Compliant (${compliant})`
                : s === 'PARTIAL'
                  ? `Partial (${partial})`
                  : `Not Started (${notStarted})`}
          </button>
        ))}
      </div>

      {/* Mappings grouped by clause */}
      {loading ? (
        <Card>
          <div className="h-48 animate-pulse bg-muted rounded" />
        </Card>
      ) : filteredMappings.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <CheckCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-sm text-muted-foreground">
              {statusFilter !== 'ALL'
                ? `No controls with status "${statusFilter.replace(/_/g, ' ')}"`
                : 'No control mappings found for this standard'}
            </p>
          </div>
        </Card>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => {
            const na = Number(a);
            const nb = Number(b);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return a.localeCompare(b);
          })
          .map(([clause, items]) => {
            const isCollapsed = collapsedClauses.has(clause);
            const clauseCompliant = items.filter((m) => m.status === 'COMPLIANT').length;
            const clausePct = items.length ? Math.round((clauseCompliant / items.length) * 100) : 0;

            return (
              <Card key={clause}>
                <div
                  className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleClause(clause)}
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                    <h3 className="text-sm font-semibold">
                      Clause {clause} — {CLAUSE_SECTION_TITLES[clause] || ''}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {clauseCompliant}/{items.length}
                    </span>
                    <div className="w-16 bg-muted rounded-full h-1.5">
                      <div
                        className="bg-primary rounded-full h-1.5 transition-all"
                        style={{ width: `${clausePct}%` }}
                      />
                    </div>
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="divide-y divide-border">
                    {items.map((m) => (
                      <div key={m.id} className="px-5 py-3">
                        {editing === m.id ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground">
                                {m.clauseNumber}
                              </span>
                              <span className="text-sm font-medium">{m.clauseTitle}</span>
                              {m.harmonizedGroupId && (
                                <Badge variant="info">HLS</Badge>
                              )}
                            </div>
                            <Select
                              id={`status-${m.id}`}
                              label="Status"
                              value={editForm.status}
                              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                              options={[
                                { value: 'NOT_STARTED', label: 'Not Started' },
                                { value: 'PARTIAL', label: 'Partial' },
                                { value: 'COMPLIANT', label: 'Compliant' },
                              ]}
                            />
                            <Textarea
                              id={`evidence-${m.id}`}
                              label="Evidence Description"
                              value={editForm.evidenceDescription}
                              onChange={(e) =>
                                setEditForm({ ...editForm, evidenceDescription: e.target.value })
                              }
                            />
                            <Textarea
                              id={`docs-${m.id}`}
                              label="Linked Documents"
                              value={editForm.linkedDocuments}
                              onChange={(e) =>
                                setEditForm({ ...editForm, linkedDocuments: e.target.value })
                              }
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={save}>
                                Save
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="flex items-start justify-between cursor-pointer group"
                            onClick={() => startEdit(m)}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-muted-foreground">
                                  {m.clauseNumber}
                                </span>
                                <span className="text-sm font-medium text-foreground">
                                  {m.clauseTitle}
                                </span>
                                {m.harmonizedGroupId && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">
                                    HLS
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {m.requirement}
                              </p>
                              {m.evidenceDescription && (
                                <p className="text-xs text-foreground mt-1 bg-muted/50 rounded px-2 py-1">
                                  {m.evidenceDescription}
                                </p>
                              )}
                            </div>
                            <Badge variant={statusVariant(m.status)}>
                              {m.status.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })
      )}
    </div>
  );
}
