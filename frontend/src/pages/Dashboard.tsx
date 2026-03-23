import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import api from '../api/client';
import {
  Server,
  AlertTriangle,
  ShieldAlert,
  CheckCircle,
  ClipboardCheck,
  TrendingUp,
  GraduationCap,
  ScrollText,
  Clock,
  Brain,
} from 'lucide-react';
import CompetenceCheckModal from '../components/CompetenceCheckModal';

interface RecentActivity {
  id: string;
  userName: string;
  action: string;
  entity: string;
  entityName?: string;
  details?: string;
  createdAt: string;
}

interface SystemNeedingReview {
  id: string;
  name: string;
  lastReviewDate: string | null;
}

interface StandardCompliance {
  standardCode: string;
  total: number;
  compliant: number;
  partial: number;
  notStarted: number;
  percentage: number;
}

interface DashboardData {
  totalSystems: number;
  activeSystems: number;
  openRisks: number;
  activeIncidents: number;
  openFindings: number;
  compliancePercentage: number;
  compliantMappings: number;
  partialMappings: number;
  notStartedMappings: number;
  totalMappings: number;
  risksByCategory: { category: string; count: number }[];
  risksBySeverity: { rating: string; count: number }[];
  trainingCompletionRate: number;
  totalUsers: number;
  usersWithIncompleteTraining: number;
  systemsNeedingReview: SystemNeedingReview[];
  recentActivity: RecentActivity[];
  standardsCompliance?: StandardCompliance[];
  upcomingObligations: number;
  overdueObligations: number;
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

const kpiCards = (data: DashboardData) => [
  {
    label: 'AI Systems',
    value: data.totalSystems,
    sub: `${data.activeSystems} active`,
    icon: Server,
    color: 'text-kmi-primary',
    bg: 'bg-sky-50',
  },
  {
    label: 'Open Risks',
    value: data.openRisks,
    sub: 'across all systems',
    icon: AlertTriangle,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    label: 'Active Incidents',
    value: data.activeIncidents,
    sub: 'reported or investigating',
    icon: ShieldAlert,
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
  {
    label: 'Compliance',
    value: `${data.compliancePercentage}%`,
    sub: `${data.compliantMappings}/${data.totalMappings} controls`,
    icon: CheckCircle,
    color: data.compliancePercentage >= 80 ? 'text-emerald-600' : 'text-amber-600',
    bg: data.compliancePercentage >= 80 ? 'bg-emerald-50' : 'bg-amber-50',
  },
  {
    label: 'Upcoming Obligations',
    value: data.upcomingObligations,
    sub: 'due within 30 days',
    icon: Clock,
    color: data.upcomingObligations > 0 ? 'text-amber-600' : 'text-emerald-600',
    bg: data.upcomingObligations > 0 ? 'bg-amber-50' : 'bg-emerald-50',
  },
  ...(data.overdueObligations > 0 ? [{
    label: 'Overdue',
    value: data.overdueObligations,
    sub: 'obligations past due',
    icon: AlertTriangle,
    color: 'text-red-600',
    bg: 'bg-red-50',
  }] : []),
];

const actionVariant: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  CREATE: 'success',
  COMPLETE: 'success',
  APPROVE: 'success',
  ASSIGN: 'info',
  LOGIN: 'info',
  UPDATE: 'warning',
  DELETE: 'error',
  REMOVE: 'error',
  SKIP: 'warning',
  ACTIVATE: 'success',
  DEACTIVATE: 'warning',
};

const entityLabels: Record<string, string> = {
  SYSTEM: 'AI System',
  RISK: 'Risk',
  INCIDENT: 'Incident',
  LIFECYCLE: 'Lifecycle',
  OVERSIGHT: 'Oversight',
  MONITORING: 'Monitoring',
  AUDIT: 'Audit',
  AUDIT_FINDING: 'Finding',
  TRAINING: 'Training',
  USER: 'User',
  AUTH: 'Auth',
  GOVERNANCE_ROLE: 'Role',
  CONTROL_MAPPING: 'Control',
  MANAGEMENT_REVIEW: 'Review',
  SCHEDULED_OBLIGATION: 'Obligation',
  OBLIGATION_INSTANCE: 'Obligation',
  STANDARD: 'Standard',
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPendingCheck, setHasPendingCheck] = useState(false);
  const [showCompetenceModal, setShowCompetenceModal] = useState(false);

  useEffect(() => {
    api.get('/compliance/dashboard')
      .then((res) => setData(res.data.dashboard))
      .finally(() => setLoading(false));
    // Check for pending competence checks
    api.get('/competence/pending')
      .then((res) => { if (res.data.question) setHasPendingCheck(true); })
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="h-28 animate-pulse bg-muted rounded" />
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Competence Check Banner */}
      {hasPendingCheck && (
        <Card className="border-kmi-bright/30 bg-sky-50/50">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-kmi-bright/10">
                <Brain className="w-5 h-5 text-kmi-bright" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Competence check due</p>
                <p className="text-xs text-muted-foreground">Answer a quick question to verify your training retention</p>
              </div>
            </div>
            <button
              onClick={() => setShowCompetenceModal(true)}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-kmi-dark transition-colors"
            >
              Take Check
            </button>
          </CardContent>
        </Card>
      )}

      {showCompetenceModal && (
        <CompetenceCheckModal onClose={() => { setShowCompetenceModal(false); setHasPendingCheck(false); }} />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpiCards(data).map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="flex items-start gap-4 py-5">
              <div className={`p-2.5 rounded-lg ${kpi.bg}`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
                <p className="text-2xl font-semibold text-foreground mt-0.5">{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Multi-Standard Compliance Overview */}
        <Card>
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" /> Compliance by Standard
            </h3>
            <Link to="/compliance" className="text-xs text-kmi-bright hover:underline">
              View details
            </Link>
          </div>
          <CardContent>
            {data.standardsCompliance && data.standardsCompliance.length > 0 ? (
              <div className="space-y-2.5">
                {data.standardsCompliance.map((sc) => (
                  <Link
                    key={sc.standardCode}
                    to="/compliance"
                    className="block hover:bg-muted/30 rounded px-1 py-0.5 -mx-1 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-foreground">
                        {STANDARD_SHORT[sc.standardCode] || sc.standardCode}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          {sc.compliant}/{sc.total}
                        </span>
                        <span className={`text-xs font-semibold ${
                          sc.percentage >= 80 ? 'text-emerald-600' : sc.percentage >= 40 ? 'text-amber-600' : 'text-slate-400'
                        }`}>
                          {sc.percentage}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className={`rounded-full h-1.5 transition-all ${
                          sc.percentage >= 80 ? 'bg-emerald-500' : sc.percentage >= 40 ? 'bg-amber-500' : 'bg-slate-300'
                        }`}
                        style={{ width: `${sc.percentage}%` }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground">No standards activated yet</p>
                <Link to="/admin/standards" className="text-xs text-primary hover:underline mt-1 inline-block">
                  Configure standards
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk Breakdown */}
        <Card>
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Risk Breakdown
            </h3>
          </div>
          <CardContent>
            {data.risksByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No open risks recorded</p>
            ) : (
              <div className="space-y-2.5">
                {data.risksByCategory.map((r) => (
                  <div key={r.category} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">
                      {r.category.replace('_', ' ')}
                    </span>
                    <Badge variant={r.count > 3 ? 'error' : r.count > 1 ? 'warning' : 'default'}>
                      {r.count}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {data.risksBySeverity.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">By Rating</p>
                <div className="flex gap-3">
                  {data.risksBySeverity.map((r) => (
                    <Badge
                      key={r.rating}
                      variant={
                        r.rating === 'CRITICAL' ? 'error'
                          : r.rating === 'HIGH' ? 'warning'
                          : 'default'
                      }
                    >
                      {r.rating}: {r.count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Training Completion */}
        <Card>
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <GraduationCap className="w-4 h-4" /> Training Competence
            </h3>
          </div>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Completion Rate</span>
                <span className="font-medium">{data.trainingCompletionRate}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div
                  className={`rounded-full h-2.5 transition-all ${
                    data.trainingCompletionRate >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${data.trainingCompletionRate}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>{data.totalUsers - data.usersWithIncompleteTraining} of {data.totalUsers} users fully trained</span>
                {data.usersWithIncompleteTraining > 0 && (
                  <Link to="/training" className="text-kmi-bright hover:underline">
                    {data.usersWithIncompleteTraining} incomplete
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Systems Needing Review */}
        <Card>
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4" /> Systems Needing Review
            </h3>
          </div>
          <CardContent>
            {data.systemsNeedingReview.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">All systems are up to date</p>
            ) : (
              <div className="space-y-2.5">
                {data.systemsNeedingReview.map((s) => (
                  <div key={s.id} className="flex items-center justify-between">
                    <Link to="/systems" className="text-sm text-foreground hover:text-kmi-bright truncate">
                      {s.name}
                    </Link>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {s.lastReviewDate
                        ? `Last: ${new Date(s.lastReviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                        : 'Never reviewed'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Open Findings */}
      {data.openFindings > 0 && (
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <div className="p-2 rounded-lg bg-amber-50">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-sm">
              <span className="font-semibold">{data.openFindings}</span>{' '}
              <span className="text-muted-foreground">open audit findings require attention</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ScrollText className="w-4 h-4" /> Recent Activity
          </h3>
          <Link to="/activity-log" className="text-xs text-kmi-bright hover:underline">
            View all
          </Link>
        </div>
        <div className="divide-y divide-border">
          {data.recentActivity.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-muted-foreground">No activity recorded yet</div>
          ) : (
            data.recentActivity.map((log) => (
              <div key={log.id} className="px-5 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{log.userName}</span>
                    <Badge variant={actionVariant[log.action] ?? 'default'}>
                      {log.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {entityLabels[log.entity] ?? log.entity}
                    </span>
                    {log.entityName && (
                      <span className="text-xs text-foreground truncate hidden sm:inline">
                        — {log.entityName}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatTime(log.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
