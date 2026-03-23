import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { logActivity } from '../../services/auditLog';

/**
 * GET /competence/pending
 * Returns the user's next pending competence check question (one at a time).
 * Finds the oldest due COMPETENCE_EVALUATION obligation instance for the user,
 * then picks a random question from that module.
 */
export async function getPendingCheck(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  // Find pending COMPETENCE_EVALUATION instances assigned to this user
  const instance = await prisma.obligationInstance.findFirst({
    where: {
      status: 'PENDING',
      obligation: {
        type: 'COMPETENCE_EVALUATION',
        assigneeId: userId,
        status: 'ACTIVE',
      },
      dueDate: { lte: new Date() },
    },
    include: { obligation: true },
    orderBy: { dueDate: 'asc' },
  });

  if (!instance) {
    res.json({ question: null, instanceId: null });
    return;
  }

  const moduleId = instance.obligation.linkedEntityId;
  if (!moduleId) {
    res.json({ question: null, instanceId: null });
    return;
  }

  // Pick a random question from this module
  const questions = await prisma.assessmentQuestion.findMany({
    where: { moduleId },
  });

  if (questions.length === 0) {
    res.json({ question: null, instanceId: null });
    return;
  }

  const randomQ = questions[Math.floor(Math.random() * questions.length)];
  const module = await prisma.trainingModule.findUnique({
    where: { id: moduleId },
    select: { title: true, slug: true },
  });

  res.json({
    question: {
      id: randomQ.id,
      question: randomQ.question,
      options: JSON.parse(randomQ.options),
      hint: randomQ.hint,
      moduleTitle: module?.title,
      moduleSlug: module?.slug,
    },
    instanceId: instance.id,
    obligationId: instance.obligationId,
  });
}

/**
 * POST /competence/answer
 * Submit an answer to a competence check question.
 * Records the check, adjusts obligation frequency, and completes the instance.
 */
const answerSchema = z.object({
  questionId: z.string(),
  selectedIndex: z.number().int().min(0).max(3),
  instanceId: z.string(),
  usedHint: z.boolean().default(false),
});

export async function submitAnswer(req: Request, res: Response): Promise<void> {
  const parsed = answerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const userId = req.user!.userId;
  const { questionId, selectedIndex, instanceId, usedHint } = parsed.data;

  // Verify the question exists
  const question = await prisma.assessmentQuestion.findUnique({ where: { id: questionId } });
  if (!question) {
    res.status(404).json({ error: 'Question not found' });
    return;
  }

  // Verify the instance exists and belongs to this user
  const instance = await prisma.obligationInstance.findUnique({
    where: { id: instanceId },
    include: { obligation: true },
  });
  if (!instance || instance.obligation.assigneeId !== userId) {
    res.status(404).json({ error: 'Obligation instance not found' });
    return;
  }

  const correct = selectedIndex === question.correctIndex;

  // Record the competence check
  const check = await prisma.competenceCheck.create({
    data: {
      userId,
      questionId,
      moduleId: question.moduleId,
      selectedIndex,
      correct,
      usedHint,
    },
  });

  // Calculate rolling competence score for this user+module (last 10 checks)
  const recentChecks = await prisma.competenceCheck.findMany({
    where: { userId, moduleId: question.moduleId },
    orderBy: { answeredAt: 'desc' },
    take: 10,
  });

  const rollingScore = recentChecks.length > 0
    ? Math.round(
        (recentChecks.reduce((sum, c) => {
          if (c.correct && !c.usedHint) return sum + 1.0;
          if (c.correct && c.usedHint) return sum + 0.5;
          return sum;
        }, 0) / recentChecks.length) * 100
      )
    : 0;

  // Get the module's pass threshold
  const module = await prisma.trainingModule.findUnique({
    where: { id: question.moduleId },
    select: { passThreshold: true },
  });
  const threshold = module?.passThreshold ?? 80;

  // Adaptive frequency: above threshold = weekly (7 days), below = daily (1 day)
  const newCustomDays = rollingScore >= threshold ? 7 : 1;
  const oldCustomDays = instance.obligation.customDays;

  if (oldCustomDays !== newCustomDays) {
    await prisma.scheduledObligation.update({
      where: { id: instance.obligationId },
      data: { customDays: newCustomDays },
    });
  }

  // Complete the obligation instance and create the next one
  const now = new Date();
  await prisma.obligationInstance.update({
    where: { id: instanceId },
    data: {
      status: 'COMPLETED',
      completedAt: now,
      completedById: userId,
      linkedRecordId: check.id,
      linkedRecordType: 'COMPETENCE_CHECK',
      notes: `${correct ? 'Correct' : 'Incorrect'}${usedHint ? ' (used hint)' : ''} — score: ${rollingScore}%`,
    },
  });

  // Create next instance with the (possibly updated) interval
  const nextDue = new Date(now.getTime() + newCustomDays * 24 * 60 * 60 * 1000);
  await prisma.obligationInstance.create({
    data: {
      obligationId: instance.obligationId,
      dueDate: nextDue,
    },
  });

  // Check for 3 consecutive failures — trigger retraining
  const lastThreeChecks = await prisma.competenceCheck.findMany({
    where: { userId, moduleId: question.moduleId },
    orderBy: { answeredAt: 'desc' },
    take: 3,
  });

  const threeConsecutiveFailures =
    lastThreeChecks.length === 3 && lastThreeChecks.every((c) => !c.correct);

  if (threeConsecutiveFailures) {
    // Check if a TRAINING_RENEWAL obligation already exists for this user+module
    const existingRenewal = await prisma.scheduledObligation.findFirst({
      where: {
        type: 'TRAINING_RENEWAL',
        assigneeId: userId,
        linkedEntityId: question.moduleId,
        status: 'ACTIVE',
      },
    });

    if (!existingRenewal) {
      const renewalObligation = await prisma.scheduledObligation.create({
        data: {
          type: 'TRAINING_RENEWAL',
          title: `Retraining required — ${module?.passThreshold ?? 80}% competence threshold not met`,
          standardCode: instance.obligation.standardCode,
          frequency: 'CUSTOM_DAYS',
          customDays: 14,
          anchorDate: now,
          assigneeId: userId,
          linkedEntityId: question.moduleId,
          linkedEntityType: 'TRAINING_MODULE',
        },
      });
      await prisma.obligationInstance.create({
        data: {
          obligationId: renewalObligation.id,
          dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        },
      });
      await logActivity(req, 'CREATE', 'SCHEDULED_OBLIGATION', renewalObligation.id, renewalObligation.title, 'Auto-created from 3 consecutive competence check failures');
    }
  }

  await logActivity(
    req,
    correct ? 'COMPETENCE_CHECK_PASS' : 'COMPETENCE_CHECK_FAIL',
    'COMPETENCE_CHECK',
    check.id,
    question.question.substring(0, 50),
    `Score: ${rollingScore}%, Frequency: ${newCustomDays === 1 ? 'daily' : 'weekly'}`,
  );

  res.json({
    correct,
    correctIndex: question.correctIndex,
    explanation: question.explanation,
    rollingScore,
    frequency: newCustomDays === 1 ? 'daily' : 'weekly',
    usedHint,
  });
}

/**
 * GET /competence/history
 * Returns the user's own competence check history.
 */
export async function getHistory(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const checks = await prisma.competenceCheck.findMany({
    where: { userId },
    include: {
      module: { select: { title: true, slug: true } },
      question: { select: { question: true } },
    },
    orderBy: { answeredAt: 'desc' },
    take: 50,
  });

  res.json({
    checks: checks.map((c) => ({
      id: c.id,
      moduleTitle: c.module.title,
      question: c.question.question.substring(0, 80),
      correct: c.correct,
      usedHint: c.usedHint,
      answeredAt: c.answeredAt,
    })),
  });
}

/**
 * GET /competence/dashboard
 * Admin dashboard with aggregated competence data.
 */
export async function getDashboard(req: Request, res: Response): Promise<void> {
  // Per-user statistics
  const userStats = await prisma.competenceCheck.groupBy({
    by: ['userId'],
    _count: { id: true },
    _avg: { selectedIndex: true }, // placeholder — we'll compute manually
  });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const perUser = await Promise.all(
    userStats.map(async (stat) => {
      const checks = await prisma.competenceCheck.findMany({
        where: { userId: stat.userId },
        orderBy: { answeredAt: 'desc' },
        take: 50,
      });

      const totalChecks = checks.length;
      const correctCount = checks.filter((c) => c.correct).length;
      const hintCount = checks.filter((c) => c.usedHint).length;
      const user = userMap.get(stat.userId);

      // Get current obligation frequency
      const obligation = await prisma.scheduledObligation.findFirst({
        where: { type: 'COMPETENCE_EVALUATION', assigneeId: stat.userId, status: 'ACTIVE' },
        select: { customDays: true },
      });

      return {
        userId: stat.userId,
        name: user?.name ?? 'Unknown',
        email: user?.email ?? '',
        totalChecks,
        correctCount,
        score: totalChecks > 0 ? Math.round((correctCount / totalChecks) * 100) : 0,
        hintUsageRate: totalChecks > 0 ? Math.round((hintCount / totalChecks) * 100) : 0,
        frequency: obligation?.customDays === 1 ? 'daily' : 'weekly',
        lastCheck: checks[0]?.answeredAt ?? null,
      };
    })
  );

  // Per-module statistics
  const moduleStats = await prisma.competenceCheck.groupBy({
    by: ['moduleId'],
    _count: { id: true },
  });

  const modules = await prisma.trainingModule.findMany({
    select: { id: true, title: true, slug: true },
    include: { _count: { select: { questions: true } } },
  });
  const moduleMap = new Map(modules.map((m) => [m.id, m]));

  const perModule = await Promise.all(
    moduleStats.map(async (stat) => {
      const checks = await prisma.competenceCheck.findMany({
        where: { moduleId: stat.moduleId },
      });
      const correctCount = checks.filter((c) => c.correct).length;
      const hintCount = checks.filter((c) => c.usedHint).length;
      const mod = moduleMap.get(stat.moduleId);

      return {
        moduleId: stat.moduleId,
        title: mod?.title ?? 'Unknown',
        questionCount: mod?._count?.questions ?? 0,
        totalChecks: checks.length,
        avgScore: checks.length > 0 ? Math.round((correctCount / checks.length) * 100) : 0,
        hintUsageRate: checks.length > 0 ? Math.round((hintCount / checks.length) * 100) : 0,
      };
    })
  );

  // Flagged users (on daily frequency or 3+ consecutive failures)
  const flagged = perUser.filter((u) => u.frequency === 'daily' || u.score < 50);

  // Summary
  const allChecks = await prisma.competenceCheck.count();
  const allCorrect = await prisma.competenceCheck.count({ where: { correct: true } });
  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);
  const checksThisMonth = await prisma.competenceCheck.count({
    where: { answeredAt: { gte: thisMonth } },
  });

  res.json({
    summary: {
      overallPassRate: allChecks > 0 ? Math.round((allCorrect / allChecks) * 100) : 0,
      totalChecks: allChecks,
      checksThisMonth,
      usersRequiringRetraining: flagged.length,
    },
    perUser,
    perModule,
    flagged,
  });
}
