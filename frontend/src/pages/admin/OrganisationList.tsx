import { useEffect, useState, FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Building2, Plus, X, CheckCircle, AlertCircle, Users, Shield } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  schema_name: string;
  plan: string;
  status: string;
  max_users: number;
  contact_email: string;
  contact_name: string;
  created_at: string;
}

interface TenantStandard {
  id: string;
  activated_at: string;
  standard: {
    code: string;
    short_title: string;
  };
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
  onpremise: 'On-Premise',
};

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  active: 'success',
  suspended: 'warning',
  cancelled: 'error',
};

export default function OrganisationList() {
  const { isAdmin } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [tenantStandards, setTenantStandards] = useState<Record<string, TenantStandard[]>>({});

  // New tenant form
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    contactEmail: '',
    contactName: '',
    plan: 'starter',
    maxUsers: '5',
    adminEmail: '',
    adminName: '',
    adminPassword: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const { isSuperAdmin } = useAuth();
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const load = () =>
    api.get('/platform/tenants').then((r) => setTenants(r.data.tenants));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const loadTenantStandards = async (tenantId: string) => {
    if (tenantStandards[tenantId]) return;
    try {
      const r = await api.get(`/platform/tenants/${tenantId}/standards`);
      setTenantStandards((prev) => ({ ...prev, [tenantId]: r.data.standards }));
    } catch {
      // Silently handle if standards can't be loaded
    }
  };

  const toggleExpand = (tenantId: string) => {
    if (expandedTenant === tenantId) {
      setExpandedTenant(null);
    } else {
      setExpandedTenant(tenantId);
      loadTenantStandards(tenantId);
    }
  };

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const setField = (field: string) => (e: any) => {
    const value = e.target.value;
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'name' && !slugManuallyEdited) {
        next.slug = generateSlug(value);
      }
      if (field === 'slug') {
        setSlugManuallyEdited(true);
        next.slug = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
      }
      return next;
    });
  };

  const resetForm = () => {
    setFormData({
      name: '', slug: '', contactEmail: '', contactName: '',
      plan: 'starter', maxUsers: '5',
      adminEmail: '', adminName: '', adminPassword: '',
    });
    setSlugManuallyEdited(false);
    setShowForm(false);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setMessage(null);

    if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      setMessage({ type: 'error', text: 'Identifier must contain only lowercase letters, numbers and hyphens' });
      setFormLoading(false);
      return;
    }

    try {
      await api.post('/platform/tenants', {
        name: formData.name,
        slug: formData.slug,
        contactEmail: formData.contactEmail,
        contactName: formData.contactName,
        plan: formData.plan,
        maxUsers: parseInt(formData.maxUsers, 10),
        adminEmail: formData.adminEmail || undefined,
        adminName: formData.adminName || undefined,
        adminPassword: formData.adminPassword || undefined,
      });
      setMessage({ type: 'success', text: `Organisation "${formData.name}" created successfully` });
      resetForm();
      load();
    } catch (err: any) {
      let errorText = err.response?.data?.error || 'Failed to create organisation';
      // Show specific field errors from zod validation
      const details = err.response?.data?.details?.fieldErrors;
      if (details) {
        const fieldMessages = Object.entries(details)
          .filter(([, msgs]) => Array.isArray(msgs) && (msgs as string[]).length > 0)
          .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)
          .join('; ');
        if (fieldMessages) errorText = fieldMessages;
      }
      setMessage({ type: 'error', text: errorText });
    } finally {
      setFormLoading(false);
    }
  };

  const updateStatus = async (tenant: Tenant, status: string) => {
    try {
      await api.patch(`/platform/tenants/${tenant.id}`, { status });
      setMessage({ type: 'success', text: `${tenant.name} ${status === 'active' ? 'activated' : status}` });
      load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update organisation' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-muted rounded animate-pulse" />
        <div className="h-48 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Organisations</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tenants.length} organisation{tenants.length !== 1 ? 's' : ''} on the platform
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> New Organisation</>}
        </Button>
      </div>

      {message && (
        <div className={`p-3 rounded-md flex items-center gap-2 text-sm ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Create Organisation Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold">New Organisation</h3>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  id="name"
                  label="Organisation Name"
                  value={formData.name}
                  onChange={setField('name')}
                  placeholder="Acme Ltd"
                  required
                />
                <div>
                  <Input
                    id="slug"
                    label="Identifier (URL-safe)"
                    value={formData.slug}
                    onChange={setField('slug')}
                    placeholder="acme-ltd"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Lowercase letters, numbers and hyphens only
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  id="contactName"
                  label="Primary Contact"
                  value={formData.contactName}
                  onChange={setField('contactName')}
                  placeholder="Jane Smith"
                  required
                />
                <Input
                  id="contactEmail"
                  label="Contact Email"
                  type="email"
                  value={formData.contactEmail}
                  onChange={setField('contactEmail')}
                  placeholder="jane@acme.com"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  id="plan"
                  label="Plan"
                  value={formData.plan}
                  onChange={setField('plan')}
                  options={[
                    { value: 'starter', label: 'Starter' },
                    { value: 'professional', label: 'Professional' },
                    { value: 'enterprise', label: 'Enterprise' },
                    { value: 'onpremise', label: 'On-Premise' },
                  ]}
                />
                <Input
                  id="maxUsers"
                  label="Max Users"
                  type="number"
                  value={formData.maxUsers}
                  onChange={setField('maxUsers')}
                />
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-foreground mb-3">
                  Organisation Admin (optional)
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Creates an admin user within the new organisation. They will be
                  prompted to change their password on first login.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    id="adminName"
                    label="Admin Name"
                    value={formData.adminName}
                    onChange={setField('adminName')}
                    placeholder="Jane Smith"
                  />
                  <Input
                    id="adminEmail"
                    label="Admin Email"
                    type="email"
                    value={formData.adminEmail}
                    onChange={setField('adminEmail')}
                    placeholder="jane@acme.com"
                  />
                  <Input
                    id="adminPassword"
                    label="Temporary Password"
                    type="text"
                    value={formData.adminPassword}
                    onChange={setField('adminPassword')}
                    placeholder="Min 6 characters"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={formLoading}>
                  {formLoading ? 'Creating...' : 'Create Organisation'}
                </Button>
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tenant List */}
      <div className="space-y-2">
        {tenants.map((t) => (
          <Card key={t.id} className={expandedTenant === t.id ? 'ring-1 ring-primary/20' : ''}>
            <CardContent className="py-4">
              <div
                className="flex items-center gap-4 cursor-pointer"
                onClick={() => toggleExpand(t.id)}
              >
                <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4.5 h-4.5 text-kmi-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-foreground">{t.name}</h4>
                    <Badge variant={STATUS_VARIANT[t.status] || 'default'}>
                      {t.status}
                    </Badge>
                    <Badge variant="default">
                      {PLAN_LABELS[t.plan] || t.plan}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span>{t.contact_name}</span>
                    <span>{t.contact_email}</span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {t.max_users} max
                    </span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>

              {/* Expanded detail */}
              {expandedTenant === t.id && (
                <div className="mt-4 pt-4 border-t border-border space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Identifier</p>
                      <p className="font-medium font-mono">{t.slug}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Schema</p>
                      <p className="font-medium font-mono">{t.schema_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Plan</p>
                      <p className="font-medium">{PLAN_LABELS[t.plan] || t.plan}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Max Users</p>
                      <p className="font-medium">{t.max_users}</p>
                    </div>
                  </div>

                  {/* Active Standards */}
                  {tenantStandards[t.id] && tenantStandards[t.id].length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Active Standards</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tenantStandards[t.id].map((ts) => (
                          <Badge key={ts.id} variant="default">
                            <Shield className="w-3 h-3 mr-1" />
                            {ts.standard.short_title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {tenantStandards[t.id] && tenantStandards[t.id].length === 0 && (
                    <p className="text-xs text-muted-foreground">No standards activated</p>
                  )}

                  {/* Status actions */}
                  <div className="flex gap-2">
                    {t.status === 'active' && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(t, 'suspended')}>
                        Suspend
                      </Button>
                    )}
                    {t.status === 'suspended' && (
                      <>
                        <Button size="sm" onClick={() => updateStatus(t, 'active')}>
                          Reactivate
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateStatus(t, 'cancelled')}>
                          Cancel
                        </Button>
                      </>
                    )}
                    {t.status === 'cancelled' && (
                      <Button size="sm" onClick={() => updateStatus(t, 'active')}>
                        Reactivate
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {tenants.length === 0 && (
          <Card>
            <div className="py-12 text-center">
              <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium text-foreground">No organisations yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create your first organisation to get started.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
