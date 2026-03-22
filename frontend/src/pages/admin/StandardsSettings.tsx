import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Shield, CheckCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

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

/**
 * Plain-language summaries for each ISO standard. Written for a professional
 * audience that may not be familiar with the specifics of each certification.
 */
const STANDARD_DETAILS: Record<string, { summary: string; involves: string[]; outcome: string }> = {
  ISO_42001: {
    summary: 'The first international standard for managing artificial intelligence responsibly. It provides a structured approach to governing AI systems throughout their lifecycle, covering everything from risk assessment to human oversight.',
    involves: [
      'Establishing an AI governance policy and assigning accountability',
      'Maintaining an inventory of all AI systems and their risk profiles',
      'Conducting impact assessments before deploying AI systems',
      'Ensuring human oversight, transparency, and explainability',
      'Monitoring AI system performance and managing drift or degradation',
      'Training staff on responsible AI use and associated risks',
    ],
    outcome: 'Demonstrates that your organisation develops, deploys, and operates AI systems in a controlled, ethical, and risk-aware manner.',
  },
  ISO_27001: {
    summary: 'The global benchmark for information security. It requires organisations to identify security risks to their information and apply a systematic set of controls to protect it, whether stored digitally, on paper, or in people\u2019s heads.',
    involves: [
      'Identifying information assets and assessing threats to their confidentiality, integrity, and availability',
      'Implementing security controls from a comprehensive catalogue (Annex A)',
      'Managing access control, encryption, network security, and physical security',
      'Establishing incident response procedures and business continuity plans',
      'Running internal audits and management reviews at planned intervals',
      'Maintaining a Statement of Applicability documenting which controls apply and why',
    ],
    outcome: 'Proves to clients, regulators, and partners that your organisation takes information security seriously and manages it systematically.',
  },
  ISO_9001: {
    summary: 'The world\u2019s most widely adopted management system standard. It focuses on consistently delivering products and services that meet customer expectations while continually improving how the organisation operates.',
    involves: [
      'Understanding customer requirements and measuring satisfaction',
      'Defining and documenting key business processes',
      'Setting quality objectives and tracking performance against them',
      'Managing suppliers and controlling externally provided products or services',
      'Handling nonconformities, complaints, and corrective actions',
      'Conducting regular management reviews to drive improvement',
    ],
    outcome: 'Provides confidence that your organisation delivers consistent quality and is committed to continuous improvement.',
  },
  ISO_27701: {
    summary: 'An extension to ISO 27001 that adds privacy-specific requirements. It helps organisations manage personal data in line with regulations such as GDPR, establishing clear responsibilities for data controllers and processors.',
    involves: [
      'Mapping personal data flows and identifying processing activities',
      'Assigning privacy roles and responsibilities within the organisation',
      'Implementing controls for consent, data subject rights, and breach notification',
      'Conducting privacy impact assessments for new processing activities',
      'Managing third-party data processors and their compliance obligations',
      'Maintaining records of processing activities as required by privacy law',
    ],
    outcome: 'Shows that your organisation manages personal data responsibly and can evidence compliance with privacy regulations.',
  },
  ISO_27017: {
    summary: 'Supplementary guidance for securing cloud services. It builds on ISO 27002 with additional controls specific to cloud environments, addressing responsibilities shared between cloud service providers and their customers.',
    involves: [
      'Clarifying security responsibilities between cloud provider and customer',
      'Securing virtual machines, containers, and cloud storage',
      'Managing identity and access in multi-tenant cloud environments',
      'Monitoring cloud service activity and logging security events',
      'Ensuring data isolation between tenants',
      'Defining exit strategies and data portability procedures',
    ],
    outcome: 'Demonstrates that cloud-specific security risks are understood and managed, whether you provide or consume cloud services.',
  },
  ISO_27018: {
    summary: 'A code of practice for protecting personally identifiable information (PII) in public cloud environments. It addresses the privacy obligations of cloud service providers acting as data processors.',
    involves: [
      'Implementing controls for lawful processing of PII in the cloud',
      'Ensuring transparency about where data is stored and processed',
      'Supporting data subject access requests and deletion rights',
      'Restricting use of customer data for advertising or secondary purposes',
      'Notifying customers promptly in the event of a data breach',
      'Returning or securely deleting data when a contract ends',
    ],
    outcome: 'Gives cloud customers assurance that their personal data is handled with appropriate privacy safeguards.',
  },
  ISO_27002: {
    summary: 'The reference catalogue of information security controls that supports ISO 27001. It provides detailed implementation guidance for each control, organised into four themes: organisational, people, physical, and technological.',
    involves: [
      'Selecting and implementing controls appropriate to identified risks',
      'Applying organisational controls such as policies, roles, and asset management',
      'Addressing people-related controls including screening, awareness, and remote working',
      'Implementing physical controls for secure areas, equipment, and media',
      'Deploying technological controls covering access, cryptography, and monitoring',
      'Using the guidance to build or refine your Statement of Applicability',
    ],
    outcome: 'Provides a practical toolkit for implementing the security controls your organisation needs.',
  },
  ISO_22301: {
    summary: 'Ensures your organisation can continue operating during and after disruptive events. It covers everything from power failures and cyber attacks to supply chain disruption and natural disasters.',
    involves: [
      'Identifying critical business functions and their dependencies',
      'Conducting business impact analyses to understand the consequences of disruption',
      'Developing and maintaining business continuity plans and recovery strategies',
      'Running exercises and tests to validate plans work in practice',
      'Establishing crisis communication procedures',
      'Reviewing and improving plans after incidents or exercises',
    ],
    outcome: 'Demonstrates that your organisation can maintain essential operations when things go wrong.',
  },
  ISO_20000: {
    summary: 'The international standard for IT service management. It aligns with ITIL practices and requires organisations to plan, deliver, and improve IT services in a structured way.',
    involves: [
      'Defining a service catalogue and agreeing service levels with customers',
      'Managing incidents, problems, and changes through formal processes',
      'Controlling service releases and deployments',
      'Managing supplier relationships and third-party service delivery',
      'Monitoring service performance and reporting against agreed targets',
      'Continually improving service quality based on measured outcomes',
    ],
    outcome: 'Proves that your IT services are managed professionally and deliver reliable, measurable value.',
  },
  ISO_31000: {
    summary: 'A principles-based framework for managing risk across any type of organisation. It is not certifiable but provides the foundation that other risk-focused standards build upon.',
    involves: [
      'Establishing a risk management framework tailored to your context',
      'Defining risk criteria and appetite at the leadership level',
      'Identifying, analysing, and evaluating risks systematically',
      'Selecting and implementing risk treatments proportionate to the threat',
      'Monitoring risks and reviewing treatment effectiveness over time',
      'Embedding risk-aware decision-making into everyday operations',
    ],
    outcome: 'Creates a consistent, organisation-wide approach to identifying and managing risk.',
  },
  ISO_23894: {
    summary: 'Guidance on managing risk specifically associated with AI systems. It helps organisations understand and address risks that arise from AI behaviour, data dependencies, and the potential for unintended consequences.',
    involves: [
      'Identifying AI-specific risks including bias, opacity, and data quality issues',
      'Assessing risks related to AI system reliability, safety, and fairness',
      'Establishing risk criteria tailored to AI contexts and use cases',
      'Integrating AI risk management with your broader risk framework',
      'Monitoring AI systems for performance drift, bias drift, and emergent behaviour',
      'Documenting risk decisions and maintaining traceability',
    ],
    outcome: 'Ensures that the unique risks of AI systems are recognised, assessed, and managed alongside traditional operational risks.',
  },
  ISO_25024: {
    summary: 'Defines how to measure and evaluate the quality of data. It covers completeness, accuracy, consistency, timeliness, and other characteristics that determine whether data is fit for purpose.',
    involves: [
      'Defining data quality requirements based on how the data is used',
      'Measuring data against characteristics such as accuracy, completeness, and currency',
      'Identifying and addressing data quality deficiencies',
      'Establishing data quality metrics and monitoring them over time',
      'Reporting data quality to relevant stakeholders',
      'Integrating data quality management into data governance processes',
    ],
    outcome: 'Provides a structured way to assess whether your data is reliable enough for the decisions and systems that depend on it.',
  },
  ISO_5338: {
    summary: 'Defines the processes that make up the AI system lifecycle, from initial concept through development, deployment, operation, and eventual retirement. It brings the same lifecycle discipline used in software engineering to AI.',
    involves: [
      'Planning and scoping AI system development with clear objectives',
      'Managing data collection, preparation, and validation as formal processes',
      'Building, testing, and validating AI models with documented procedures',
      'Deploying AI systems with appropriate release controls',
      'Operating and monitoring AI systems in production',
      'Retiring AI systems responsibly, including data and model disposal',
    ],
    outcome: 'Brings engineering rigour to the full lifecycle of AI systems, reducing the risk of ungoverned or poorly managed deployments.',
  },
  ISO_42005: {
    summary: 'Guidance for assessing the broader impact of AI systems on individuals, communities, and society. It goes beyond technical risk to consider ethical, social, and human rights implications.',
    involves: [
      'Identifying stakeholders who may be affected by an AI system',
      'Assessing potential positive and negative impacts on individuals and groups',
      'Evaluating effects on human rights, fairness, and social wellbeing',
      'Documenting impact assessment findings and mitigation measures',
      'Reviewing assessments periodically and when systems change significantly',
      'Engaging affected communities and incorporating their perspectives',
    ],
    outcome: 'Demonstrates that your organisation considers the wider societal consequences of its AI systems, not just the technical performance.',
  },
};

export default function StandardsSettings() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [standards, setStandards] = useState<StandardInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  const toggleExpand = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
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
            {group.items.map((s) => {
              const details = STANDARD_DETAILS[s.code];
              const isExpanded = expanded.has(s.code);

              return (
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

                        {/* Learn more toggle */}
                        {details && (
                          <button
                            onClick={() => toggleExpand(s.code)}
                            className="flex items-center gap-1 text-xs text-primary hover:underline mt-1.5"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                            Learn more
                          </button>
                        )}

                        {/* Expanded detail panel */}
                        {details && isExpanded && (
                          <div className="mt-3 pt-3 border-t border-border space-y-3">
                            <p className="text-sm text-foreground leading-relaxed">
                              {details.summary}
                            </p>
                            <div>
                              <p className="text-xs font-semibold text-foreground mb-1.5">
                                What this involves
                              </p>
                              <ul className="space-y-1">
                                {details.involves.map((item, i) => (
                                  <li key={i} className="text-xs text-muted-foreground flex gap-2">
                                    <span className="text-primary mt-0.5 flex-shrink-0">&#8226;</span>
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="bg-muted/50 rounded-md px-3 py-2">
                              <p className="text-xs font-semibold text-foreground mb-0.5">
                                What certification demonstrates
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {details.outcome}
                              </p>
                            </div>
                          </div>
                        )}

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
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
