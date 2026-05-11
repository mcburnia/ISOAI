import { useEffect, useState } from 'react';
import { FileText, Table, GraduationCap, Download, Loader2, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import api from '../../api/client';

interface Standard {
  code: string;
  label: string;
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

type DownloadState = 'idle' | 'loading' | 'done' | 'error';

function useDownload() {
  const [state, setState] = useState<DownloadState>('idle');

  async function trigger(url: string, filename: string) {
    setState('loading');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);

      setState('done');
      setTimeout(() => setState('idle'), 3000);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }

  return { state, trigger };
}

function DownloadButton({
  state,
  onClick,
  label = 'Download',
}: {
  state: DownloadState;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={state === 'loading'}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        state === 'done'
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : state === 'error'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-kmi-navy text-white hover:bg-kmi-navy/90 disabled:opacity-60'
      }`}
    >
      {state === 'loading' ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : state === 'done' ? (
        <CheckCircle className="w-4 h-4" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      {state === 'done' ? 'Downloaded' : state === 'error' ? 'Failed — retry' : label}
    </button>
  );
}

export default function Reports() {
  const [standards, setStandards] = useState<Standard[]>([]);
  const [selectedStandard, setSelectedStandard] = useState<string>('ALL');

  const pdfDownload = useDownload();
  const csvDownload = useDownload();
  const trainingDownload = useDownload();

  useEffect(() => {
    api.get('/compliance/standards').then((r) => {
      const stds: string[] = r.data.standards;
      setStandards(stds.map((code) => ({ code, label: STANDARD_LABELS[code] ?? code })));
    });
  }, []);

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Export & Reports</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Download your compliance data for audits, board reviews, and external reporting.
        </p>
      </div>

      {/* Compliance Report PDF */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-kmi-navy/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-kmi-navy" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Compliance Report</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                A formatted PDF summary of your compliance posture across all active standards.
                Includes control mapping status, open risks, incidents, audit findings, and
                overdue obligations. Suitable for handing to an external auditor or board.
              </p>
              <div className="mt-4">
                <DownloadButton
                  state={pdfDownload.state}
                  onClick={() =>
                    pdfDownload.trigger(
                      '/api/reports/compliance-report.pdf',
                      `compliance-report-${today}.pdf`
                    )
                  }
                  label="Download PDF"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Control Mapping CSV */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-kmi-coral/10 flex items-center justify-center flex-shrink-0">
              <Table className="w-5 h-5 text-kmi-coral" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Control Mapping</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                A flat CSV of all control mappings — clause number, title, requirement, status,
                evidence description, and attached file count. Useful for gap analysis in Excel
                or for sharing with a consultant.
              </p>
              <div className="flex items-end gap-3 mt-4">
                {standards.length > 0 && (
                  <div className="w-72">
                    <Select
                      id="csv-standard"
                      label="Standard"
                      value={selectedStandard}
                      onChange={(e) => setSelectedStandard(e.target.value)}
                      options={[
                        { value: 'ALL', label: 'All active standards' },
                        ...standards.map((s) => ({ value: s.code, label: s.label })),
                      ]}
                    />
                  </div>
                )}
                <DownloadButton
                  state={csvDownload.state}
                  onClick={() => {
                    const params = selectedStandard !== 'ALL'
                      ? `?standardCode=${selectedStandard}`
                      : '';
                    csvDownload.trigger(
                      `/api/reports/control-mapping.csv${params}`,
                      `control-mapping-${today}.csv`
                    );
                  }}
                  label="Download CSV"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Training Records CSV */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Training Records</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                All training completion records with name, module, standard, completion date,
                pass score, and evidence. Provides documented evidence for ISO clause 7.2
                (Competence) during audits.
              </p>
              <div className="mt-4">
                <DownloadButton
                  state={trainingDownload.state}
                  onClick={() =>
                    trainingDownload.trigger(
                      '/api/reports/training-records.csv',
                      `training-records-${today}.csv`
                    )
                  }
                  label="Download CSV"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
