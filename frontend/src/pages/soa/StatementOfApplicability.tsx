import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Download, Loader2, AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

interface Mapping {
  id: string;
  standardCode: string;
  clauseNumber: string;
  clauseTitle: string;
  requirement: string;
  status: string;
  applicable: boolean;
  justification: string | null;
  evidenceDescription: string | null;
}

interface Standard {
  code: string;
  label: string;
}

const STANDARD_LABELS: Record<string, string> = {
  ISO_42001: 'ISO 42001 — AI Management System',
  ISO_27001: 'ISO 27001 — Information Security',
  ISO_9001:  'ISO 9001 — Quality Management',
  ISO_27701: 'ISO 27701 — Privacy Information',
  ISO_27017: 'ISO 27017 — Cloud Security',
  ISO_27018: 'ISO 27018 — Cloud Privacy',
  ISO_27002: 'ISO 27002 — Security Controls',
  ISO_22301: 'ISO 22301 — Business Continuity',
  ISO_20000: 'ISO 20000-1 — IT Service Management',
  ISO_31000: 'ISO 31000 — Risk Management',
  ISO_23894: 'ISO 23894 — AI Risk Management',
  ISO_25024: 'ISO 25024 — Data Quality',
  ISO_5338:  'ISO 5338 — AI Lifecycle',
  ISO_42005: 'ISO 42005 — AI Impact Assessment',
};

const STATUS_LABELS: Record<string, string> = {
  COMPLIANT:   'Compliant',
  PARTIAL:     'Partial',
  NOT_STARTED: 'Not Started',
};

type DownloadState = 'idle' | 'loading' | 'done' | 'error';

export default function StatementOfApplicability() {
  const { canWrite } = useAuth();
  const [standards, setStandards] = useState<Standard[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null); // mapping id being saved
  const [editingJustification, setEditingJustification] = useState<string | null>(null); // mapping id
  const [justificationDraft, setJustificationDraft] = useState('');
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [filter, setFilter] = useState<'all' | 'applicable' | 'excluded'>('all');

  // Load active standards
  useEffect(() => {
    api.get('/compliance/standards').then((r) => {
      const codes: string[] = r.data.standards;
      const stds = codes.map((code) => ({ code, label: STANDARD_LABELS[code] ?? code }));
      setStandards(stds);
      if (stds.length > 0) setSelectedCode(stds[0].code);
    });
  }, []);

  // Load mappings for selected standard
  const loadMappings = useCallback(() => {
    if (!selectedCode) return;
    setLoading(true);
    api.get('/compliance/mappings', { params: { standardCode: selectedCode } })
      .then((r) => setMappings(r.data.mappings))
      .finally(() => setLoading(false));
  }, [selectedCode]);

  useEffect(() => { loadMappings(); }, [loadMappings]);

  async function toggleApplicable(mapping: Mapping) {
    if (!canWrite) return;
    const newValue = !mapping.applicable;
    // Optimistic update
    setMappings((prev) => prev.map((m) => m.id === mapping.id ? { ...m, applicable: newValue } : m));
    setSaving(mapping.id);
    try {
      await api.patch(`/compliance/mappings/${mapping.id}`, { applicable: newValue });
    } catch {
      // Revert on error
      setMappings((prev) => prev.map((m) => m.id === mapping.id ? { ...m, applicable: !newValue } : m));
    } finally {
      setSaving(null);
    }
  }

  function startEditJustification(mapping: Mapping) {
    if (!canWrite) return;
    setEditingJustification(mapping.id);
    setJustificationDraft(mapping.justification ?? '');
  }

  async function saveJustification(mapping: Mapping) {
    setSaving(mapping.id);
    try {
      await api.patch(`/compliance/mappings/${mapping.id}`, { justification: justificationDraft });
      setMappings((prev) =>
        prev.map((m) => m.id === mapping.id ? { ...m, justification: justificationDraft } : m)
      );
      setEditingJustification(null);
    } finally {
      setSaving(null);
    }
  }

  async function downloadPdf() {
    setDownloadState('loading');
    try {
      const token = localStorage.getItem('token');
      const params = selectedCode ? `?standardCode=${selectedCode}` : '';
      const res = await fetch(`/api/reports/soa.pdf${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `statement-of-applicability-${selectedCode.toLowerCase().replace(/_/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
      setDownloadState('done');
      setTimeout(() => setDownloadState('idle'), 3000);
    } catch {
      setDownloadState('error');
      setTimeout(() => setDownloadState('idle'), 3000);
    }
  }

  const filtered = mappings.filter((m) => {
    if (filter === 'applicable') return m.applicable !== false;
    if (filter === 'excluded') return m.applicable === false;
    return true;
  });

  const applicable   = mappings.filter((m) => m.applicable !== false).length;
  const excluded     = mappings.filter((m) => m.applicable === false).length;
  const noJustification = mappings.filter((m) => m.applicable === false && !m.justification).length;

  if (standards.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Info className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium text-foreground">No active standards</p>
          <p className="text-xs text-muted-foreground mt-1">
            Activate at least one standard in Admin › Standards to generate a Statement of Applicability.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-72">
          <Select
            id="soa-standard"
            label="Standard"
            value={selectedCode}
            onChange={(e) => setSelectedCode(e.target.value)}
            options={standards.map((s) => ({ value: s.code, label: s.label }))}
          />
        </div>
        <div className="flex-1" />
        <button
          onClick={downloadPdf}
          disabled={downloadState === 'loading' || !selectedCode}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            downloadState === 'done'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : downloadState === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-kmi-navy text-white hover:bg-kmi-navy/90 disabled:opacity-60'
          }`}
        >
          {downloadState === 'loading' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : downloadState === 'done' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {downloadState === 'done' ? 'Downloaded' : downloadState === 'error' ? 'Failed — retry' : 'Download SoA PDF'}
        </button>
      </div>

      {/* Stats strip */}
      {!loading && mappings.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setFilter(filter === 'all' ? 'all' : 'all')}
            className="bg-card border border-border rounded-lg px-4 py-3 text-left hover:border-primary/30 transition-colors"
          >
            <p className="text-2xl font-bold text-foreground">{mappings.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Controls</p>
          </button>
          <button
            onClick={() => setFilter(filter === 'applicable' ? 'all' : 'applicable')}
            className={`rounded-lg px-4 py-3 text-left border transition-colors ${
              filter === 'applicable'
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-card border-border hover:border-primary/30'
            }`}
          >
            <p className="text-2xl font-bold text-emerald-600">{applicable}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Applicable</p>
          </button>
          <button
            onClick={() => setFilter(filter === 'excluded' ? 'all' : 'excluded')}
            className={`rounded-lg px-4 py-3 text-left border transition-colors ${
              filter === 'excluded'
                ? 'bg-red-50 border-red-200'
                : 'bg-card border-border hover:border-primary/30'
            }`}
          >
            <p className="text-2xl font-bold text-red-500">{excluded}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Excluded</p>
          </button>
        </div>
      )}

      {/* Warning: excluded controls without justification */}
      {noJustification > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{noJustification} excluded control{noJustification > 1 ? 's' : ''}</span>
            {' '}lack a justification. ISO certification requires a written reason for every exclusion.
            {canWrite && ' Click the justification cell to add one.'}
          </p>
        </div>
      )}

      {/* Explanation */}
      <div className="flex items-start gap-3 bg-sky-50 border border-sky-100 rounded-lg px-4 py-3">
        <Info className="w-4 h-4 text-sky-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-sky-800 leading-relaxed">
          The Statement of Applicability lists every control in the standard and records whether it applies to your
          organisation. Controls that do not apply must be excluded with a written justification — this is a mandatory
          artefact for ISO certification. {canWrite ? 'Toggle the tick/cross to change applicability, then add a justification in the rightmost column.' : 'Contact an administrator to update applicability or justifications.'}
        </p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground w-24">Clause</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Control Title</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground w-28">Applicable</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground w-28">Status</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Justification / Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const isApplicable = m.applicable !== false;
                const missingJustification = !isApplicable && !m.justification;
                const isEditingThis = editingJustification === m.id;
                const isSavingThis = saving === m.id;

                return (
                  <tr
                    key={m.id}
                    className={`border-b border-border last:border-0 ${
                      !isApplicable ? 'bg-muted/30' : 'hover:bg-muted/20'
                    }`}
                  >
                    {/* Clause */}
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{m.clauseNumber}</td>

                    {/* Title */}
                    <td className="py-3 px-4">
                      <p className={`font-medium text-sm ${isApplicable ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                        {m.clauseTitle}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{m.requirement}</p>
                    </td>

                    {/* Applicable toggle */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => toggleApplicable(m)}
                        disabled={!canWrite || isSavingThis}
                        title={canWrite ? (isApplicable ? 'Mark as not applicable' : 'Mark as applicable') : undefined}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          canWrite ? 'cursor-pointer' : 'cursor-default'
                        } ${
                          isApplicable
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-red-50 text-red-600 hover:bg-red-100'
                        } disabled:opacity-60`}
                      >
                        {isSavingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isApplicable ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        {isApplicable ? 'Yes' : 'No'}
                      </button>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      {isApplicable ? (
                        <span className={`text-xs font-medium ${
                          m.status === 'COMPLIANT' ? 'text-emerald-600'
                          : m.status === 'PARTIAL' ? 'text-kmi-coral'
                          : 'text-muted-foreground'
                        }`}>
                          {STATUS_LABELS[m.status] ?? m.status}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Justification */}
                    <td className="py-3 px-4">
                      {isEditingThis ? (
                        <div className="flex items-start gap-2">
                          <textarea
                            autoFocus
                            value={justificationDraft}
                            onChange={(e) => setJustificationDraft(e.target.value)}
                            rows={2}
                            className="flex-1 text-xs border border-border rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder={isApplicable ? 'Optional: add context for the auditor…' : 'Required: explain why this control does not apply…'}
                          />
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => saveJustification(m)}
                              disabled={isSavingThis}
                              className="text-xs bg-kmi-navy text-white px-2 py-1 rounded hover:bg-kmi-navy/90 disabled:opacity-60"
                            >
                              {isSavingThis ? '…' : 'Save'}
                            </button>
                            <button
                              onClick={() => setEditingJustification(null)}
                              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditJustification(m)}
                          disabled={!canWrite}
                          className={`text-xs text-left w-full rounded px-1 py-0.5 -mx-1 transition-colors ${
                            canWrite ? 'hover:bg-muted cursor-pointer' : 'cursor-default'
                          } ${missingJustification ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}
                        >
                          {m.justification
                            ? m.justification
                            : missingJustification
                              ? '⚠ Justification required'
                              : canWrite
                                ? 'Click to add…'
                                : '—'
                          }
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No controls match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
