import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Shield, CheckCircle, Loader2 } from 'lucide-react';

interface StandardInfo {
  id: string;
  code: string;
  title: string;
  shortTitle: string;
  category: string;
  description: string;
  controlCount: number;
  activated: boolean;
  activatedAt: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  CERTIFIABLE: 'Certifiable Standards',
  GUIDANCE: 'Guidance Standards',
  FRAMEWORK: 'Framework Standards',
};

const CATEGORY_ORDER = ['CERTIFIABLE', 'GUIDANCE', 'FRAMEWORK'];

export default function StandardsSettings() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [standards, setStandards] = useState<StandardInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    api.get('/settings/standards')
      .then((r) => setStandards(r.data.standards))
      .finally(() => setLoading(false));
  }, [isAdmin, navigate]);

  const toggle = async (standard: StandardInfo) => {
    setToggling(standard.code);
    try {
      const endpoint = standard.activated
        ? `/settings/standards/${standard.code}/deactivate`
        : `/settings/standards/${standard.code}/activate`;
      await api.post(endpoint);

      setStandards((prev) =>
        prev.map((s) =>
          s.code === standard.code
            ? { ...s, activated: !s.activated, activatedAt: s.activated ? null : new Date().toISOString() }
            : s
        )
      );
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat] || cat,
    items: standards.filter((s) => s.category === cat),
  })).filter((g) => g.items.length > 0);

  const activeCount = standards.filter((s) => s.activated).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">ISO Standards</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Select the standards your organisation is working towards. Compliance tracking,
            training, and dashboard metrics will reflect your selection.
          </p>
        </div>
        <Badge variant={activeCount > 0 ? 'success' : 'default'}>
          {activeCount} active
        </Badge>
      </div>

      {grouped.map((group) => (
        <div key={group.category}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
            {group.label}
          </h3>
          <div className="space-y-2">
            {group.items.map((s) => (
              <Card key={s.code} className={s.activated ? 'ring-1 ring-primary/20' : ''}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => toggle(s)}
                      disabled={toggling === s.code}
                      className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        s.activated
                          ? 'bg-primary border-primary text-white'
                          : 'border-muted-foreground/30 hover:border-primary/50'
                      }`}
                    >
                      {toggling === s.code ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : s.activated ? (
                        <CheckCircle className="w-3.5 h-3.5" />
                      ) : null}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground">{s.title}</h4>
                        {s.controlCount > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {s.controlCount} controls
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                      {s.activated && s.activatedAt && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Activated {new Date(s.activatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      <Shield className={`w-4 h-4 ${s.activated ? 'text-primary' : 'text-muted-foreground/30'}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
