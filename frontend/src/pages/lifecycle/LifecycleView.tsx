import { useEffect, useState } from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import api from '../../api/client';
import { GitBranch, CheckCircle, Clock, ArrowRight } from 'lucide-react';

interface LifecycleEntry {
  id: string;
  stage: number;
  stageName: string;
  status: string;
  approvedBy: { name: string } | null;
  completedAt: string | null;
}

interface System { id: string; name: string; }

const stageIcon = (status: string) => {
  if (status === 'COMPLETED') return <CheckCircle className="w-5 h-5 text-emerald-500" />;
  if (status === 'IN_PROGRESS') return <Clock className="w-5 h-5 text-amber-500 animate-pulse" />;
  return <div className="w-5 h-5 rounded-full border-2 border-slate-300" />;
};

export default function LifecycleView() {
  const [systems, setSystems] = useState<System[]>([]);
  const [selectedSystem, setSelectedSystem] = useState('');
  const [entries, setEntries] = useState<LifecycleEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get('/systems').then((r) => setSystems(r.data.systems)); }, []);

  useEffect(() => {
    if (!selectedSystem) return;
    setLoading(true);
    api.get(`/lifecycle?systemId=${selectedSystem}`)
      .then((r) => setEntries(r.data.entries))
      .finally(() => setLoading(false));
  }, [selectedSystem]);

  const initLifecycle = async () => {
    await api.post(`/lifecycle/init/${selectedSystem}`);
    const res = await api.get(`/lifecycle?systemId=${selectedSystem}`);
    setEntries(res.data.entries);
  };

  const advanceStage = async (entry: LifecycleEntry) => {
    const nextStatus = entry.status === 'PENDING' ? 'IN_PROGRESS' : 'COMPLETED';
    await api.patch(`/lifecycle/${entry.id}`, { status: nextStatus });
    const res = await api.get(`/lifecycle?systemId=${selectedSystem}`);
    setEntries(res.data.entries);
  };

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Select id="system" label="Select AI System" value={selectedSystem}
          onChange={(e) => setSelectedSystem(e.target.value)}
          options={systems.map((s) => ({ value: s.id, label: s.name }))} />
      </div>

      {selectedSystem && !loading && entries.length === 0 && (
        <Card>
          <div className="py-12 text-center">
            <GitBranch className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">No lifecycle stages initialised</p>
            <Button onClick={initLifecycle} size="sm">Initialise Lifecycle Stages</Button>
          </div>
        </Card>
      )}

      {entries.length > 0 && (
        <Card>
          <CardContent className="py-6">
            <div className="space-y-0">
              {entries.map((entry, i) => (
                <div key={entry.id} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    {stageIcon(entry.status)}
                    {i < entries.length - 1 && (
                      <div className={`w-0.5 h-12 my-1 ${entry.status === 'COMPLETED' ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                    )}
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Stage {entry.stage}: {entry.stageName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={
                            entry.status === 'COMPLETED' ? 'success'
                              : entry.status === 'IN_PROGRESS' ? 'warning'
                              : 'default'
                          }>{entry.status}</Badge>
                          {entry.approvedBy && (
                            <span className="text-xs text-muted-foreground">Approved by {entry.approvedBy.name}</span>
                          )}
                          {entry.completedAt && (
                            <span className="text-xs text-muted-foreground">{new Date(entry.completedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      {entry.status !== 'COMPLETED' && (
                        <Button size="sm" variant="outline" onClick={() => advanceStage(entry)}>
                          <ArrowRight className="w-3 h-3" />
                          {entry.status === 'PENDING' ? 'Start' : 'Complete'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
