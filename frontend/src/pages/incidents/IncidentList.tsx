import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Plus, ShieldAlert } from 'lucide-react';

interface Incident {
  id: string;
  title: string;
  severity: string;
  status: string;
  occurredAt: string;
  system: { name: string };
  reportedBy: { name: string };
  assignedTo: { name: string } | null;
}

const sevVariant = (s: string) => ({ CRITICAL: 'error', HIGH: 'warning', MEDIUM: 'info', LOW: 'default' }[s] || 'default') as any;
const statVariant = (s: string) => ({ REPORTED: 'error', INVESTIGATING: 'warning', RESOLVED: 'success', CLOSED: 'default' }[s] || 'default') as any;

export default function IncidentList() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const { canWrite } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/incidents').then((r) => setIncidents(r.data.incidents)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{incidents.length} incidents</p>
        {canWrite && <Link to="/incidents/new"><Button size="sm"><Plus className="w-4 h-4" /> Report Incident</Button></Link>}
      </div>

      {loading ? <Card><div className="h-40 animate-pulse bg-muted rounded" /></Card>
      : incidents.length === 0 ? (
        <Card><div className="py-12 text-center">
          <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No incidents reported</p>
        </div></Card>
      ) : (
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Incident</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">System</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Severity</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
            </tr></thead>
            <tbody>{incidents.map((i) => (
              <tr key={i.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="py-3 px-4 font-medium text-foreground">{i.title}</td>
                <td className="py-3 px-4 text-muted-foreground">{i.system.name}</td>
                <td className="py-3 px-4"><Badge variant={sevVariant(i.severity)}>{i.severity}</Badge></td>
                <td className="py-3 px-4"><Badge variant={statVariant(i.status)}>{i.status}</Badge></td>
                <td className="py-3 px-4 text-muted-foreground">{new Date(i.occurredAt).toLocaleDateString()}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
