export interface ObligationDefault {
  type: string;
  titleTemplate: string;
  clauseRef: string;
  frequency: string;
  standardCodes: string[];
}

/**
 * Default obligations seeded when a standard is activated.
 * Only includes org-level recurring items. Per-entity obligations
 * (per AI system, per document) are created manually by the admin.
 */
export const OBLIGATION_DEFAULTS: ObligationDefault[] = [
  {
    type: 'INTERNAL_AUDIT',
    titleTemplate: 'Internal audit',
    clauseRef: '9.2',
    frequency: 'ANNUAL',
    standardCodes: ['ISO_42001', 'ISO_27001', 'ISO_9001', 'ISO_22301', 'ISO_20000'],
  },
  {
    type: 'MANAGEMENT_REVIEW',
    titleTemplate: 'Management review',
    clauseRef: '9.3',
    frequency: 'ANNUAL',
    standardCodes: ['ISO_42001', 'ISO_27001', 'ISO_9001', 'ISO_22301', 'ISO_20000'],
  },
  {
    type: 'RISK_ASSESSMENT',
    titleTemplate: 'Risk assessment review',
    clauseRef: '6.1.2',
    frequency: 'SEMI_ANNUAL',
    standardCodes: ['ISO_42001', 'ISO_27001', 'ISO_9001', 'ISO_22301', 'ISO_20000'],
  },
  {
    type: 'MONITORING_REVIEW',
    titleTemplate: 'Monitoring and measurement review',
    clauseRef: '9.1',
    frequency: 'QUARTERLY',
    standardCodes: ['ISO_42001', 'ISO_27001', 'ISO_9001', 'ISO_22301', 'ISO_20000'],
  },
];

/**
 * Returns the default anchor date for a frequency — one full cycle from today.
 */
export function defaultAnchorDate(frequency: string): Date {
  const now = new Date();
  switch (frequency) {
    case 'MONTHLY': return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    case 'QUARTERLY': return new Date(now.getTime() + 91 * 24 * 60 * 60 * 1000);
    case 'SEMI_ANNUAL': return new Date(now.getTime() + 182 * 24 * 60 * 60 * 1000);
    case 'ANNUAL': return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    default: return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  }
}

/**
 * Returns the defaults applicable to a given standard code.
 */
export function getDefaultsForStandard(standardCode: string): ObligationDefault[] {
  return OBLIGATION_DEFAULTS.filter((d) => d.standardCodes.includes(standardCode));
}
