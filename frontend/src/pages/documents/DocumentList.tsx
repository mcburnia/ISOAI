import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import Badge from '../../components/ui/Badge';
import { FileText, BookOpen, Shield, AlertTriangle, ClipboardList, Settings, Map } from 'lucide-react';

interface Document {
  id: string;
  title: string;
  slug: string;
  documentType: string;
  owner: string;
  version: string;
  status: string;
  reviewCycle: string | null;
  lastReviewedAt: string | null;
  updatedAt: string;
}

const typeConfig: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'; icon: typeof FileText }> = {
  POLICY: { label: 'Policy', variant: 'purple', icon: Shield },
  PROCEDURE: { label: 'Procedure', variant: 'info', icon: ClipboardList },
  FRAMEWORK: { label: 'Framework', variant: 'default', icon: BookOpen },
  STANDARD: { label: 'Standard', variant: 'success', icon: Settings },
  REGISTER: { label: 'Register', variant: 'warning', icon: AlertTriangle },
  MANUAL: { label: 'Manual', variant: 'default', icon: BookOpen },
  CONTROL_MAPPING: { label: 'Control Mapping', variant: 'info', icon: Map },
};

const statusConfig: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  APPROVED: 'success',
  DRAFT: 'warning',
  UNDER_REVIEW: 'info' as 'default',
  SUPERSEDED: 'error',
};

export default function DocumentList() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    api.get('/documents').then((res) => {
      setDocuments(res.data.documents);
      setLoading(false);
    });
  }, []);

  const types = ['ALL', ...Object.keys(typeConfig)];
  const filtered = filter === 'ALL' ? documents : documents.filter((d) => d.documentType === filter);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-border h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Policy Documents</h2>
          <p className="text-sm text-muted-foreground mt-1">
            AIMS governance documents — policies, procedures, frameworks, and standards
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {types.map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === type
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            }`}
          >
            {type === 'ALL' ? `All (${documents.length})` : `${typeConfig[type]?.label || type} (${documents.filter(d => d.documentType === type).length})`}
          </button>
        ))}
      </div>

      {/* Document cards */}
      <div className="space-y-3">
        {filtered.map((doc) => {
          const tc = typeConfig[doc.documentType];
          const Icon = tc?.icon || FileText;
          return (
            <Link
              key={doc.id}
              to={`/documents/${doc.slug}`}
              className="block bg-white rounded-lg border border-border hover:border-primary/30 hover:shadow-sm transition-all p-4"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-kmi-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-foreground truncate">{doc.title}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={tc?.variant || 'default'}>{tc?.label || doc.documentType}</Badge>
                    <Badge variant={statusConfig[doc.status] || 'default'}>{doc.status}</Badge>
                    <span>v{doc.version}</span>
                    <span className="text-border">|</span>
                    <span>Owner: {doc.owner}</span>
                    {doc.reviewCycle && (
                      <>
                        <span className="text-border">|</span>
                        <span>Review: {doc.reviewCycle}</span>
                      </>
                    )}
                    {doc.lastReviewedAt && (
                      <>
                        <span className="text-border">|</span>
                        <span>Last reviewed: {new Date(doc.lastReviewedAt).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No documents found for this filter.</p>
        </div>
      )}
    </div>
  );
}
