import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/client';
import Badge from '../../components/ui/Badge';
import { ArrowLeft, FileText, Clock, User, RefreshCw } from 'lucide-react';

interface Document {
  id: string;
  title: string;
  slug: string;
  documentType: string;
  content: string;
  owner: string;
  version: string;
  status: string;
  approvalAuthority: string | null;
  reviewCycle: string | null;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const statusVariant: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  APPROVED: 'success',
  DRAFT: 'warning',
  UNDER_REVIEW: 'info' as 'default',
  SUPERSEDED: 'error',
};

function renderMarkdown(content: string) {
  // Simple markdown rendering — headings, bold, lists, tables, horizontal rules
  const lines = content.split('\n');
  const html: string[] = [];
  let inList = false;
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      if (inList) { html.push('</ul>'); inList = false; }
      if (inTable) { html.push('</tbody></table>'); inTable = false; }
      html.push('<hr class="my-4 border-border" />');
      continue;
    }

    // Table rows
    if (line.includes('|') && line.trim().startsWith('|')) {
      if (inList) { html.push('</ul>'); inList = false; }
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
      // Skip separator rows
      if (cells.every(c => /^[-:]+$/.test(c))) continue;
      if (!inTable) {
        html.push('<table class="w-full text-sm border-collapse my-3">');
        html.push('<thead><tr>');
        cells.forEach(c => html.push(`<th class="border border-border px-3 py-2 bg-secondary text-left font-medium">${formatInline(c)}</th>`));
        html.push('</tr></thead><tbody>');
        inTable = true;
        continue;
      }
      html.push('<tr>');
      cells.forEach(c => html.push(`<td class="border border-border px-3 py-2">${formatInline(c)}</td>`));
      html.push('</tr>');
      continue;
    }

    if (inTable && !line.includes('|')) {
      html.push('</tbody></table>');
      inTable = false;
    }

    // Headings
    if (line.startsWith('# ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h1 class="text-xl font-bold text-foreground mt-6 mb-3">${formatInline(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h2 class="text-lg font-semibold text-foreground mt-5 mb-2">${formatInline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h3 class="text-base font-semibold text-foreground mt-4 mb-2">${formatInline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('#### ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h4 class="text-sm font-semibold text-foreground mt-3 mb-1">${formatInline(line.slice(5))}</h4>`);
      continue;
    }

    // Unordered list items
    if (/^[\s]*[-*] /.test(line)) {
      if (!inList) { html.push('<ul class="list-disc list-inside space-y-1 my-2 text-sm text-foreground/90">'); inList = true; }
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      const text = line.replace(/^[\s]*[-*] /, '');
      html.push(`<li class="${indent > 0 ? 'ml-4' : ''}">${formatInline(text)}</li>`);
      continue;
    }

    // Numbered list items
    if (/^\d+\. /.test(line.trim())) {
      if (!inList) { html.push('<ol class="list-decimal list-inside space-y-1 my-2 text-sm text-foreground/90">'); inList = true; }
      const text = line.replace(/^\s*\d+\. /, '');
      html.push(`<li>${formatInline(text)}</li>`);
      continue;
    }

    if (inList && line.trim() === '') {
      html.push('</ul>');
      inList = false;
    }

    // Empty line
    if (line.trim() === '') {
      html.push('<div class="h-2"></div>');
      continue;
    }

    // Paragraph
    html.push(`<p class="text-sm text-foreground/90 leading-relaxed my-1">${formatInline(line)}</p>`);
  }

  if (inList) html.push('</ul>');
  if (inTable) html.push('</tbody></table>');

  return html.join('\n');
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-secondary px-1.5 py-0.5 rounded text-xs font-mono">$1</code>');
}

export default function DocumentView() {
  const { slug } = useParams<{ slug: string }>();
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      api.get(`/documents/${slug}`).then((res) => {
        setDocument(res.data.document);
        setLoading(false);
      });
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-border h-16 animate-pulse" />
        <div className="bg-white rounded-lg border border-border h-96 animate-pulse" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p>Document not found.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <Link to="/documents" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Documents
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main content */}
        <div className="lg:col-span-3 bg-white rounded-lg border border-border p-6 lg:p-8">
          <h1 className="text-xl font-bold text-foreground mb-6">{document.title}</h1>
          <div
            className="prose-document"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(document.content) }}
          />
        </div>

        {/* Metadata sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Document Details</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-1">Status</p>
                <Badge variant={statusVariant[document.status] || 'default'}>{document.status}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Type</p>
                <p className="text-foreground">{document.documentType.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Version</p>
                <p className="text-foreground">v{document.version}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Owner</p>
                  <p className="text-foreground">{document.owner}</p>
                </div>
              </div>
              {document.approvalAuthority && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Approval Authority</p>
                  <p className="text-foreground">{document.approvalAuthority}</p>
                </div>
              )}
              {document.reviewCycle && (
                <div className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Review Cycle</p>
                    <p className="text-foreground">{document.reviewCycle}</p>
                  </div>
                </div>
              )}
              {document.lastReviewedAt && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Last Reviewed</p>
                    <p className="text-foreground">{new Date(document.lastReviewedAt).toLocaleDateString()}</p>
                  </div>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs mb-1">Last Updated</p>
                <p className="text-foreground">{new Date(document.updatedAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
