import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { prisma, getPlatformDb } from '../../prisma';
import { getActiveStandardCodes } from '../../services/activeStandards';

// ── Colours ───────────────────────────────────────────────────────────────
const NAVY  = '#0F3D7C';
const CORAL = '#F97316';
const SLATE = '#2D3748';
const LIGHT = '#F5F7FA';
const MUTED = '#94A3B8';

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function statusLabel(s: string): string {
  return { COMPLIANT: 'Compliant', PARTIAL: 'Partial', NOT_STARTED: 'Not Started' }[s] ?? s;
}

async function getOrgName(tenantId: string): Promise<string> {
  const db = getPlatformDb();
  const rows: Array<{ name: string }> = await db.$queryRaw`
    SELECT name FROM platform."Tenant" WHERE id = ${tenantId}
  `;
  return rows[0]?.name ?? 'Organisation';
}

function csvRow(values: (string | number | null | undefined)[]): string {
  return values
    .map((v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    })
    .join(',');
}

// ── PDF Compliance Report ─────────────────────────────────────────────────

export async function complianceReportPdf(req: Request, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId as string;
  const activeCodes = await getActiveStandardCodes(tenantId);

  if (activeCodes.length === 0) {
    res.status(400).json({ error: 'No active standards to report on' });
    return;
  }

  const orgName = await getOrgName(tenantId);

  // Fetch all data in parallel
  const [mappings, risks, incidents, findings, obligations, users, trainingRecords] =
    await Promise.all([
      prisma.controlMapping.findMany({
        where: { standardCode: { in: activeCodes } },
        orderBy: [{ standardCode: 'asc' }, { clauseNumber: 'asc' }],
      }),
      prisma.risk.findMany({ where: { status: 'OPEN' }, orderBy: { riskRating: 'asc' } }),
      prisma.incident.findMany({
        where: { status: { notIn: ['RESOLVED', 'CLOSED'] } },
        orderBy: { severity: 'asc' },
      }),
      prisma.auditFinding.findMany({
        where: { status: 'OPEN' },
        include: { audit: { select: { title: true } } },
      }),
      prisma.obligationInstance.findMany({
        where: { status: 'PENDING', dueDate: { lt: new Date() } },
        include: { obligation: { select: { title: true, standardCode: true } } },
        orderBy: { dueDate: 'asc' },
        take: 20,
      }),
      prisma.user.count(),
      prisma.trainingRecord.count(),
    ]);

  // Per-standard stats
  const byStandard: Record<string, { total: number; compliant: number; partial: number; notStarted: number }> = {};
  for (const m of mappings) {
    if (!byStandard[m.standardCode]) byStandard[m.standardCode] = { total: 0, compliant: 0, partial: 0, notStarted: 0 };
    byStandard[m.standardCode].total++;
    if (m.status === 'COMPLIANT') byStandard[m.standardCode].compliant++;
    else if (m.status === 'PARTIAL') byStandard[m.standardCode].partial++;
    else byStandard[m.standardCode].notStarted++;
  }

  const overall = mappings.length > 0
    ? Math.round((mappings.filter((m) => m.status === 'COMPLIANT').length / mappings.length) * 100)
    : 0;

  // Build PDF
  const doc = new PDFDocument({ margin: 50, size: 'A4', info: { Title: `Compliance Report — ${orgName}` } });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="compliance-report-${new Date().toISOString().split('T')[0]}.pdf"`);
  doc.pipe(res);

  // ── Cover header ─────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 100).fill(NAVY);
  doc.fillColor('white').fontSize(22).font('Helvetica-Bold')
    .text('KEEP', 50, 30, { continued: true })
    .fillColor(CORAL).text('ME', { continued: true })
    .fillColor('white').text('ISO.COM', { continued: false });
  doc.fontSize(10).font('Helvetica').fillColor('#CBD5E0')
    .text('Integrated Management System', 50, 58);
  doc.fillColor('white').fontSize(14).font('Helvetica-Bold')
    .text('Compliance Report', doc.page.width - 200, 35, { width: 150, align: 'right' });
  doc.fontSize(9).font('Helvetica').fillColor('#CBD5E0')
    .text(formatDate(new Date()), doc.page.width - 200, 57, { width: 150, align: 'right' });

  doc.moveDown(3.5);

  // ── Organisation & summary ───────────────────────────────────────────────
  doc.fillColor(SLATE).fontSize(18).font('Helvetica-Bold').text(orgName);
  doc.fontSize(10).font('Helvetica').fillColor(MUTED).text(`Report generated ${formatDate(new Date())}`);
  doc.moveDown(1);

  // Summary KPI boxes
  const kpis = [
    { label: 'Overall Compliance', value: `${overall}%` },
    { label: 'Total Controls', value: String(mappings.length) },
    { label: 'Open Risks', value: String(risks.length) },
    { label: 'Active Incidents', value: String(incidents.length) },
  ];
  const boxW = (doc.page.width - 100) / 4;
  const boxY = doc.y;
  kpis.forEach((kpi, i) => {
    const x = 50 + i * boxW;
    doc.rect(x, boxY, boxW - 8, 52).fill(LIGHT);
    doc.fillColor(CORAL).fontSize(20).font('Helvetica-Bold')
      .text(kpi.value, x + 8, boxY + 8, { width: boxW - 16, align: 'center' });
    doc.fillColor(MUTED).fontSize(8).font('Helvetica')
      .text(kpi.label, x + 8, boxY + 32, { width: boxW - 16, align: 'center' });
  });
  doc.y = boxY + 60;
  doc.moveDown(1);

  // ── Standards compliance ─────────────────────────────────────────────────
  doc.fillColor(NAVY).fontSize(13).font('Helvetica-Bold').text('Compliance by Standard');
  doc.moveDown(0.4);

  for (const code of activeCodes) {
    const stats = byStandard[code];
    if (!stats) continue;
    const pct = stats.total > 0 ? Math.round((stats.compliant / stats.total) * 100) : 0;
    const barWidth = (doc.page.width - 100) * (pct / 100);

    doc.fillColor(SLATE).fontSize(10).font('Helvetica-Bold').text(`${code.replace(/_/g, ' ')}`, { continued: true });
    doc.font('Helvetica').fillColor(MUTED).text(`  —  ${stats.compliant} compliant, ${stats.partial} partial, ${stats.notStarted} not started`);

    const barY = doc.y;
    doc.rect(50, barY, doc.page.width - 100, 8).fill('#E2E8F0');
    if (barWidth > 0) doc.rect(50, barY, barWidth, 8).fill(pct >= 70 ? '#10B981' : pct >= 40 ? CORAL : '#EF4444');
    doc.fillColor(MUTED).fontSize(8).text(`${pct}%`, doc.page.width - 45, barY - 1);
    doc.y = barY + 14;
    doc.moveDown(0.3);
  }

  doc.moveDown(0.8);

  // ── Open Risks ───────────────────────────────────────────────────────────
  if (risks.length > 0) {
    doc.fillColor(NAVY).fontSize(13).font('Helvetica-Bold').text('Open Risks');
    doc.moveDown(0.4);

    const risksByRating: Record<string, number> = {};
    risks.forEach((r) => { risksByRating[r.riskRating] = (risksByRating[r.riskRating] ?? 0) + 1; });
    const riskSummary = Object.entries(risksByRating).map(([k, v]) => `${v} ${k}`).join(', ');
    doc.fillColor(SLATE).fontSize(9).font('Helvetica').text(`${risks.length} open risk(s): ${riskSummary}`);
    doc.moveDown(0.3);

    for (const r of risks.slice(0, 10)) {
      doc.fillColor(SLATE).fontSize(9).font('Helvetica')
        .text(`• ${r.description.slice(0, 100)}${r.description.length > 100 ? '…' : ''}`, {
          continued: true, indent: 10,
        });
      doc.fillColor(MUTED).text(`  [${r.riskRating}]`);
    }
    if (risks.length > 10) doc.fillColor(MUTED).fontSize(8).text(`… and ${risks.length - 10} more`);
    doc.moveDown(0.8);
  }

  // ── Active Incidents ─────────────────────────────────────────────────────
  if (incidents.length > 0) {
    doc.fillColor(NAVY).fontSize(13).font('Helvetica-Bold').text('Active Incidents');
    doc.moveDown(0.4);
    for (const inc of incidents.slice(0, 10)) {
      doc.fillColor(SLATE).fontSize(9).font('Helvetica')
        .text(`• ${inc.title}`, { continued: true, indent: 10 });
      doc.fillColor(MUTED).text(`  [${inc.severity} — ${inc.status}]`);
    }
    doc.moveDown(0.8);
  }

  // ── Open Audit Findings ──────────────────────────────────────────────────
  if (findings.length > 0) {
    doc.fillColor(NAVY).fontSize(13).font('Helvetica-Bold').text('Open Audit Findings');
    doc.moveDown(0.4);
    for (const f of findings.slice(0, 10)) {
      doc.fillColor(SLATE).fontSize(9).font('Helvetica')
        .text(`• [${f.audit.title}] ${f.finding.slice(0, 100)}${f.finding.length > 100 ? '…' : ''}`,
          { indent: 10, continued: true });
      doc.fillColor(MUTED).text(`  [${f.severity}]`);
    }
    doc.moveDown(0.8);
  }

  // ── Overdue Obligations ──────────────────────────────────────────────────
  if (obligations.length > 0) {
    doc.fillColor(NAVY).fontSize(13).font('Helvetica-Bold').text('Overdue Obligations');
    doc.moveDown(0.4);
    for (const o of obligations) {
      const daysOver = Math.floor((Date.now() - o.dueDate.getTime()) / 86400000);
      doc.fillColor(SLATE).fontSize(9).font('Helvetica')
        .text(`• ${o.obligation.title}`, { continued: true, indent: 10 });
      doc.fillColor('#EF4444').text(`  [${daysOver}d overdue]`);
    }
    doc.moveDown(0.8);
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill(NAVY);
  doc.fillColor('#CBD5E0').fontSize(8).font('Helvetica')
    .text(
      `Generated by Keep Me ISO · ${formatDate(new Date())} · ${users} users · ${trainingRecords} training completions`,
      50, doc.page.height - 26, { align: 'center', width: doc.page.width - 100 },
    );

  doc.end();
}

// ── Control Mapping CSV ───────────────────────────────────────────────────

export async function controlMappingCsv(req: Request, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId as string;
  const activeCodes = await getActiveStandardCodes(tenantId);

  const requestedCode = req.query.standardCode as string | undefined;
  const codes = requestedCode && activeCodes.includes(requestedCode)
    ? [requestedCode]
    : activeCodes;

  if (codes.length === 0) {
    res.status(400).json({ error: 'No active standards' });
    return;
  }

  const mappings = await prisma.controlMapping.findMany({
    where: { standardCode: { in: codes } },
    orderBy: [{ standardCode: 'asc' }, { clauseNumber: 'asc' }],
  });

  const rows: string[] = [
    csvRow(['Standard', 'Clause', 'Title', 'Requirement', 'Status', 'Evidence Description', 'Attached Files']),
    ...mappings.map((m) => {
      let fileCount = '0';
      try {
        const files = JSON.parse(m.linkedDocuments ?? '[]');
        fileCount = Array.isArray(files) ? String(files.length) : '0';
      } catch { /* empty */ }
      return csvRow([
        m.standardCode.replace(/_/g, ' '),
        m.clauseNumber,
        m.clauseTitle,
        m.requirement,
        statusLabel(m.status),
        m.evidenceDescription,
        fileCount,
      ]);
    }),
  ];

  const filename = `control-mapping-${codes.join('-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('﻿' + rows.join('\r\n')); // BOM for Excel UTF-8 compatibility
}

// ── Training Records CSV ──────────────────────────────────────────────────

export async function trainingRecordsCsv(req: Request, res: Response): Promise<void> {
  const records = await prisma.trainingRecord.findMany({
    include: {
      user: { select: { name: true, email: true } },
      module: { select: { title: true, standardCode: true, passThreshold: true } },
    },
    orderBy: { completedAt: 'desc' },
  });

  // Get latest assessment attempt per user per module for score
  const attempts = await prisma.assessmentAttempt.findMany({
    where: { passed: true },
    orderBy: { createdAt: 'desc' },
  });

  const latestAttempt = new Map<string, typeof attempts[0]>();
  for (const a of attempts) {
    const key = `${a.userId}-${a.moduleId}`;
    if (!latestAttempt.has(key)) latestAttempt.set(key, a);
  }

  const rows: string[] = [
    csvRow(['Name', 'Email', 'Training Module', 'Standard', 'Completed Date', 'Pass Score (%)', 'Evidence', 'Files Attached']),
    ...records.map((r) => {
      const attempt = latestAttempt.get(`${r.userId}-${r.moduleId}`);
      let fileCount = '0';
      let evidenceText = r.evidence ?? '';
      try {
        const files = JSON.parse(r.evidence ?? '[]');
        if (Array.isArray(files)) { fileCount = String(files.length); evidenceText = ''; }
      } catch { /* plain text */ }

      return csvRow([
        r.user.name,
        r.user.email,
        r.module?.title ?? r.topic,
        r.module?.standardCode?.replace(/_/g, ' ') ?? '',
        formatDate(r.completedAt),
        attempt ? String(attempt.score) : '',
        evidenceText,
        fileCount,
      ]);
    }),
  ];

  const filename = `training-records-${new Date().toISOString().split('T')[0]}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('﻿' + rows.join('\r\n'));
}

// ── Statement of Applicability PDF ────────────────────────────────────────

const STANDARD_FULL_NAMES: Record<string, string> = {
  ISO_42001: 'ISO/IEC 42001:2023 — Artificial Intelligence Management System',
  ISO_27001: 'ISO/IEC 27001:2022 — Information Security Management System',
  ISO_9001:  'ISO 9001:2015 — Quality Management System',
  ISO_27701: 'ISO/IEC 27701:2019 — Privacy Information Management System',
  ISO_27017: 'ISO/IEC 27017:2015 — Cloud Security Controls',
  ISO_27018: 'ISO/IEC 27018:2019 — Cloud Privacy Controls',
  ISO_27002: 'ISO/IEC 27002:2022 — Information Security Controls',
  ISO_22301: 'ISO 22301:2019 — Business Continuity Management System',
  ISO_20000: 'ISO/IEC 20000-1:2018 — IT Service Management System',
  ISO_31000: 'ISO 31000:2018 — Risk Management',
  ISO_23894: 'ISO/IEC 23894:2023 — AI Risk Management',
  ISO_25024: 'ISO/IEC 25024:2015 — Data Quality',
  ISO_5338:  'ISO/IEC 5338:2023 — AI Lifecycle',
  ISO_42005: 'ISO/IEC 42005:2025 — AI Impact Assessment',
};

export async function soaPdf(req: Request, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId as string;
  const activeCodes = await getActiveStandardCodes(tenantId);

  const requestedCode = req.query.standardCode as string | undefined;
  const codes = requestedCode && activeCodes.includes(requestedCode)
    ? [requestedCode]
    : activeCodes;

  if (codes.length === 0) {
    res.status(400).json({ error: 'No active standards to report on' });
    return;
  }

  const orgName = await getOrgName(tenantId);
  const today = new Date();

  const mappings = await prisma.controlMapping.findMany({
    where: { standardCode: { in: codes } },
    orderBy: [{ standardCode: 'asc' }, { clauseNumber: 'asc' }],
  });

  const doc = new PDFDocument({ margin: 50, size: 'A4', info: { Title: `Statement of Applicability — ${orgName}` } });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="statement-of-applicability-${today.toISOString().split('T')[0]}.pdf"`);
  doc.pipe(res);

  // ── Cover header ──────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 100).fill(NAVY);
  doc.fillColor('white').fontSize(22).font('Helvetica-Bold')
    .text('KEEP', 50, 30, { continued: true })
    .fillColor(CORAL).text('ME', { continued: true })
    .fillColor('white').text('ISO.COM', { continued: false });
  doc.fontSize(10).font('Helvetica').fillColor('#CBD5E0')
    .text('Integrated Management System', 50, 58);
  doc.fillColor('white').fontSize(14).font('Helvetica-Bold')
    .text('Statement of Applicability', doc.page.width - 220, 35, { width: 170, align: 'right' });
  doc.fontSize(9).font('Helvetica').fillColor('#CBD5E0')
    .text(formatDate(today), doc.page.width - 220, 57, { width: 170, align: 'right' });

  doc.moveDown(3.5);

  // ── Organisation block ────────────────────────────────────────────────────
  doc.fillColor(SLATE).fontSize(18).font('Helvetica-Bold').text(orgName);
  doc.fontSize(10).font('Helvetica').fillColor(MUTED).text(`Generated ${formatDate(today)}`);
  doc.moveDown(0.5);

  // ── Legal boilerplate ─────────────────────────────────────────────────────
  doc.fillColor(SLATE).fontSize(9).font('Helvetica')
    .text(
      'This Statement of Applicability (SoA) documents all controls considered during the design of the management system, ' +
      'and records whether each control has been included or excluded. Where controls are excluded, a justification is provided. ' +
      'This document should be reviewed at least annually and updated whenever controls are added, removed, or their applicability changes.',
      { lineGap: 2 }
    );
  doc.moveDown(1);

  // ── Per-standard tables ───────────────────────────────────────────────────
  for (const code of codes) {
    const stdMappings = mappings.filter((m) => m.standardCode === code);
    if (stdMappings.length === 0) continue;

    const applicable   = stdMappings.filter((m) => m.applicable !== false);
    const excluded     = stdMappings.filter((m) => m.applicable === false);
    const noJustification = excluded.filter((m) => !m.justification);

    // Standard heading
    doc.fillColor(NAVY).fontSize(13).font('Helvetica-Bold')
      .text(STANDARD_FULL_NAMES[code] ?? code.replace(/_/g, ' '));
    doc.moveDown(0.3);

    // Summary strip
    const summaryY = doc.y;
    const summaryBoxW = (doc.page.width - 100) / 3;
    [
      { label: 'Total Controls', value: String(stdMappings.length) },
      { label: 'Applicable',     value: String(applicable.length) },
      { label: 'Excluded',       value: String(excluded.length) },
    ].forEach((item, i) => {
      const x = 50 + i * summaryBoxW;
      doc.rect(x, summaryY, summaryBoxW - 6, 40).fill(LIGHT);
      doc.fillColor(i === 2 && excluded.length > 0 ? CORAL : NAVY)
        .fontSize(16).font('Helvetica-Bold')
        .text(item.value, x + 6, summaryY + 4, { width: summaryBoxW - 12, align: 'center' });
      doc.fillColor(MUTED).fontSize(7).font('Helvetica')
        .text(item.label, x + 6, summaryY + 24, { width: summaryBoxW - 12, align: 'center' });
    });
    doc.y = summaryY + 48;
    doc.moveDown(0.5);

    if (noJustification.length > 0) {
      doc.rect(50, doc.y, doc.page.width - 100, 18).fill('#FEF3C7');
      doc.fillColor('#92400E').fontSize(8).font('Helvetica-Bold')
        .text(
          `⚠  ${noJustification.length} excluded control${noJustification.length > 1 ? 's' : ''} lack a justification — required for certification.`,
          58, doc.y + 5, { width: doc.page.width - 116 }
        );
      doc.y += 22;
      doc.moveDown(0.3);
    }

    // Column headers
    const colX = { clause: 50, title: 100, applicable: 310, status: 355, justification: 405 };
    const headerY = doc.y;
    doc.rect(50, headerY, doc.page.width - 100, 16).fill(NAVY);
    doc.fillColor('white').fontSize(7).font('Helvetica-Bold');
    doc.text('Clause',        colX.clause + 2,       headerY + 4, { width: 48 });
    doc.text('Control Title', colX.title,             headerY + 4, { width: 205 });
    doc.text('Applicable',    colX.applicable,        headerY + 4, { width: 42 });
    doc.text('Status',        colX.status,            headerY + 4, { width: 47 });
    doc.text('Justification', colX.justification,     headerY + 4, { width: doc.page.width - colX.justification - 50 });
    doc.y = headerY + 20;

    // Rows
    let rowIndex = 0;
    for (const m of stdMappings) {
      const isApplicable = m.applicable !== false;
      const rowHeight = 18;

      // Page break guard
      if (doc.y + rowHeight > doc.page.height - 60) {
        doc.addPage();
        doc.y = 50;
      }

      const rowY = doc.y;
      const bg = rowIndex % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      doc.rect(50, rowY, doc.page.width - 100, rowHeight).fill(bg);

      doc.fillColor(isApplicable ? SLATE : MUTED).fontSize(7).font(isApplicable ? 'Helvetica' : 'Helvetica-Oblique');
      doc.text(m.clauseNumber, colX.clause + 2, rowY + 5, { width: 48, ellipsis: true });
      doc.text(m.clauseTitle,  colX.title,       rowY + 5, { width: 205, ellipsis: true });

      // Applicable tick/cross
      doc.fillColor(isApplicable ? '#10B981' : '#EF4444').font('Helvetica-Bold').fontSize(8)
        .text(isApplicable ? '✓' : '✗', colX.applicable + 10, rowY + 5, { width: 22, align: 'center' });

      // Status (only meaningful when applicable)
      if (isApplicable) {
        const statusColour = m.status === 'COMPLIANT' ? '#10B981' : m.status === 'PARTIAL' ? CORAL : MUTED;
        doc.fillColor(statusColour).font('Helvetica').fontSize(7)
          .text(statusLabel(m.status), colX.status, rowY + 5, { width: 47, ellipsis: true });
      } else {
        doc.fillColor(MUTED).font('Helvetica').fontSize(7).text('—', colX.status + 14, rowY + 5);
      }

      // Justification
      const justText = m.justification ?? (isApplicable ? '' : 'No justification provided');
      doc.fillColor(isApplicable ? MUTED : (m.justification ? SLATE : '#EF4444'))
        .font('Helvetica').fontSize(7)
        .text(justText, colX.justification, rowY + 5, { width: doc.page.width - colX.justification - 50, ellipsis: true });

      doc.y = rowY + rowHeight;
      rowIndex++;
    }

    doc.moveDown(1.5);
  }

  // ── Sign-off block ─────────────────────────────────────────────────────────
  if (doc.y + 80 > doc.page.height - 60) doc.addPage();
  doc.moveDown(0.5);
  doc.fillColor(NAVY).fontSize(11).font('Helvetica-Bold').text('Approval & Sign-off');
  doc.moveDown(0.5);
  const signY = doc.y;
  const signW = (doc.page.width - 130) / 2;
  ['Prepared by', 'Approved by'].forEach((label, i) => {
    const x = 50 + i * (signW + 30);
    doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(label, x, signY);
    doc.rect(x, signY + 12, signW, 1).fill(MUTED);
    doc.fillColor(MUTED).fontSize(7).text('Name / Signature / Date', x, signY + 16);
  });
  doc.y = signY + 36;
  doc.moveDown(1);

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill(NAVY);
  doc.fillColor('#CBD5E0').fontSize(8).font('Helvetica')
    .text(
      `Statement of Applicability · ${orgName} · ${formatDate(today)} · Keep Me ISO`,
      50, doc.page.height - 26, { align: 'center', width: doc.page.width - 100 },
    );

  doc.end();
}
