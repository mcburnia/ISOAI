import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { Brain, Users, TrendingUp, AlertTriangle, Calendar } from 'lucide-react';

interface DashboardSummary {
  overallPassRate: number;
  totalChecks: number;
  checksThisMonth: number;
  usersRequiringRetraining: number;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  totalChecks: number;
  score: number;
  hintUsage: number;
  frequency: 'daily' | 'weekly';
  lastCheckDate: string | null;
}

interface ModuleRow {
  id: string;
  moduleTitle: string;
  questionCount: number;
  totalChecks: number;
  avgScore: number;
  hintUsage: number;
}

interface DashboardData {
  summary: DashboardSummary;
  users: UserRow[];
  modules: ModuleRow[];
}

export default function CompetenceDashboard() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get('/competence/dashboard')
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (!isAdmin) return <Navigate to="/" replace />;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><div className="h-24 animate-pulse bg-muted rounded" /></Card>
          ))}
        </div>
        <Card><div className="h-64 animate-pulse bg-muted rounded" /></Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Failed to load competence dashboard.</p>
      </div>
    );
  }

  const { summary, users, modules } = data;
  const flaggedUsers = users.filter((u) => u.frequency === 'daily' || u.score < 50);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.overallPassRate}%</p>
                <p className="text-xs text-muted-foreground">Overall pass rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center flex-shrink-0">
                <Brain className="w-5 h-5 text-sky-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.totalChecks}</p>
                <p className="text-xs text-muted-foreground">Total checks</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.checksThisMonth}</p>
                <p className="text-xs text-muted-foreground">Checks this month</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.usersRequiringRetraining}</p>
                <p className="text-xs text-muted-foreground">Requiring retraining</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-user table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Per-User Statistics</h3>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Email</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Checks</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Score</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Hint Usage</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Frequency</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Last Check</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className={`border-b border-border last:border-0 ${
                    u.frequency === 'daily' ? 'bg-red-50/50' : 'hover:bg-muted/30'
                  }`}
                >
                  <td className="py-3 px-4 font-medium">{u.name}</td>
                  <td className="py-3 px-4 text-muted-foreground">{u.email}</td>
                  <td className="py-3 px-4">{u.totalChecks}</td>
                  <td className="py-3 px-4">
                    <span className={u.score < 50 ? 'text-red-600 font-medium' : ''}>
                      {u.score}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{u.hintUsage}%</td>
                  <td className="py-3 px-4">
                    <Badge variant={u.frequency === 'daily' ? 'warning' : 'success'}>
                      {u.frequency}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {u.lastCheckDate ? new Date(u.lastCheckDate).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No competence check data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Per-module table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Per-Module Statistics</h3>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Module</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Questions</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Total Checks</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Avg Score</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Hint Usage</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="py-3 px-4 font-medium">{m.moduleTitle}</td>
                  <td className="py-3 px-4">{m.questionCount}</td>
                  <td className="py-3 px-4">{m.totalChecks}</td>
                  <td className="py-3 px-4">{m.avgScore}%</td>
                  <td className="py-3 px-4 text-muted-foreground">{m.hintUsage}%</td>
                </tr>
              ))}
              {modules.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No module data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Flagged users section */}
      {flaggedUsers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold">Flagged Users</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {flaggedUsers.map((u) => (
              <Card key={u.id} className="border-amber-200">
                <CardContent className="py-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <Badge variant={u.frequency === 'daily' ? 'warning' : 'error'}>
                      {u.frequency === 'daily' ? 'Daily' : `${u.score}%`}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Score: <span className={u.score < 50 ? 'text-red-600 font-medium' : ''}>{u.score}%</span></span>
                    <span>Hints: {u.hintUsage}%</span>
                    <span>Checks: {u.totalChecks}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
