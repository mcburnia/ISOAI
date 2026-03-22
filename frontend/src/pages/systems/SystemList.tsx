import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import api from '../../api/client';
import { Plus, Server } from 'lucide-react';

interface AISystem {
  id: string;
  name: string;
  description: string;
  owner: { id: string; name: string };
  environment: string;
  systemType: string;
  riskClassification: string;
  deploymentStatus: string;
  createdAt: string;
}

const statusVariant = (s: string) => {
  switch (s) {
    case 'ACTIVE': return 'success';
    case 'DEVELOPMENT': case 'TESTING': return 'info';
    case 'SUSPENDED': return 'warning';
    case 'RETIRED': return 'error';
    default: return 'default';
  }
};

const riskVariant = (r: string) => {
  switch (r) {
    case 'HIGH': return 'error';
    case 'MEDIUM': return 'warning';
    case 'LOW': return 'success';
    default: return 'default';
  }
};

export default function SystemList() {
  const [systems, setSystems] = useState<AISystem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/systems').then((res) => setSystems(res.data.systems)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{systems.length} systems registered</p>
        <Link to="/systems/new">
          <Button size="sm"><Plus className="w-4 h-4" /> Add System</Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><div className="h-20 animate-pulse bg-muted rounded" /></Card>
          ))}
        </div>
      ) : systems.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <Server className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No AI systems registered yet</p>
            <Link to="/systems/new">
              <Button size="sm" className="mt-3"><Plus className="w-4 h-4" /> Register First System</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">System</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Owner</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Risk</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {systems.map((system) => (
                <tr key={system.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">
                    <Link to={`/systems/${system.id}`} className="font-medium text-foreground hover:text-primary">
                      {system.name}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{system.description}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-muted-foreground">{system.systemType.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{system.owner.name}</td>
                  <td className="py-3 px-4">
                    <Badge variant={riskVariant(system.riskClassification)}>{system.riskClassification}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={statusVariant(system.deploymentStatus)}>{system.deploymentStatus}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
