import { useEffect, useState } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import api from '../api/client';
import {
  ScrollText,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface LogEntry {
  id: string;
  userName: string;
  action: string;
  entity: string;
  entityId?: string;
  entityName?: string;
  details?: string;
  createdAt: string;
}

const actionVariant: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  CREATE: 'success',
  COMPLETE: 'success',
  APPROVE: 'success',
  ASSIGN: 'info',
  LOGIN: 'info',
  UPDATE: 'warning',
  DELETE: 'error',
  REMOVE: 'error',
  CHANGE_PASSWORD: 'default',
  FORCE_CHANGE_PASSWORD: 'default',
};

const entityLabels: Record<string, string> = {
  SYSTEM: 'AI System',
  RISK: 'Risk',
  INCIDENT: 'Incident',
  LIFECYCLE: 'Lifecycle',
  OVERSIGHT: 'Oversight',
  MONITORING: 'Monitoring',
  AUDIT: 'Audit',
  AUDIT_FINDING: 'Audit Finding',
  TRAINING: 'Training',
  USER: 'User',
  AUTH: 'Authentication',
  GOVERNANCE_ROLE: 'Governance Role',
  CONTROL_MAPPING: 'Control Mapping',
  MANAGEMENT_REVIEW: 'Management Review',
};

const PAGE_SIZE = 25;

export default function ActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    };
    if (entityFilter) params.entity = entityFilter;
    if (actionFilter) params.action = actionFilter;

    api.get('/activity-log', { params })
      .then((res) => {
        setLogs(res.data.logs);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  }, [page, entityFilter, actionFilter]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

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
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const entities = Object.keys(entityLabels);
  const actions = ['CREATE', 'UPDATE', 'DELETE', 'COMPLETE', 'APPROVE', 'ASSIGN', 'REMOVE', 'LOGIN', 'CHANGE_PASSWORD'];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="flex items-center gap-4 py-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(0); }}
            className="text-sm border border-border rounded-md px-2.5 py-1.5 bg-background text-foreground"
          >
            <option value="">All entities</option>
            {entities.map((e) => (
              <option key={e} value={e}>{entityLabels[e]}</option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
            className="text-sm border border-border rounded-md px-2.5 py-1.5 bg-background text-foreground"
          >
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground ml-auto">{total} entries</span>
        </CardContent>
      </Card>

      {/* Log Entries */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ScrollText className="w-4 h-4" /> Activity Log
          </h3>
        </div>
        <div className="divide-y divide-border">
          {loading ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">No activity recorded yet</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{log.userName}</span>
                    <Badge variant={actionVariant[log.action] ?? 'default'}>
                      {log.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {entityLabels[log.entity] ?? log.entity}
                    </span>
                  </div>
                  {log.entityName && (
                    <p className="text-sm text-foreground mt-0.5 truncate">{log.entityName}</p>
                  )}
                  {log.details && (
                    <p className="text-xs text-muted-foreground mt-0.5">{log.details}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">
                  {formatTime(log.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
