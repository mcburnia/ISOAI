import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Plus, AlertTriangle } from 'lucide-react';

interface Risk {
  id: string;
  description: string;
  category: string;
  likelihood: string;
  impact: string;
  riskRating: string;
  status: string;
  system: { id: string; name: string };
  owner: { id: string; name: string };
}

const ratingVariant = (r: string) => {
  switch (r) {
    case 'CRITICAL': return 'error';
    case 'HIGH': return 'warning';
    case 'MEDIUM': return 'info';
    case 'LOW': return 'success';
    default: return 'default';
  }
};

const statusVariant = (s: string) => {
  switch (s) {
    case 'OPEN': return 'error';
    case 'MITIGATED': return 'warning';
    case 'CLOSED': return 'success';
    default: return 'default';
  }
};

export default function RiskList() {
  const { canWrite } = useAuth();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/risks').then((res) => setRisks(res.data.risks)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{risks.length} risks recorded</p>
        {canWrite && (
          <Link to="/risks/new">
            <Button size="sm"><Plus className="w-4 h-4" /> Add Risk</Button>
          </Link>
        )}
      </div>

      {loading ? (
        <Card><div className="h-40 animate-pulse bg-muted rounded" /></Card>
      ) : risks.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No risks recorded yet</p>
            <Link to="/risks/new"><Button size="sm" className="mt-3"><Plus className="w-4 h-4" /> Record First Risk</Button></Link>
          </div>
        </Card>
      ) : (
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Description</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">System</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Category</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Rating</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Owner</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((risk) => (
                <tr key={risk.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">
                    <p className="text-foreground line-clamp-2">{risk.description}</p>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{risk.system.name}</td>
                  <td className="py-3 px-4">
                    <Badge>{risk.category.replace(/_/g, ' ')}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={ratingVariant(risk.riskRating)}>{risk.riskRating}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={statusVariant(risk.status)}>{risk.status}</Badge>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{risk.owner.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
