import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { logActivity } from '../../services/auditLog';

// ============================================================
// QUESTION CRUD
// ============================================================

const questionSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().optional(),
  hint: z.string().optional(),
});

export async function listQuestions(req: Request, res: Response): Promise<void> {
  const mod = await prisma.trainingModule.findUnique({ where: { slug: req.params.slug } });
  if (!mod) { res.status(404).json({ error: 'Module not found' }); return; }

  const questions = await prisma.assessmentQuestion.findMany({
    where: { moduleId: mod.id },
    orderBy: { createdAt: 'asc' },
  });

  const isAdmin = req.user && ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);

  if (isAdmin) {
    // Admins see canonical order with answers
    const safe = questions.map((q) => ({
      id: q.id,
      question: q.question,
      options: JSON.parse(q.options),
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      hint: q.hint,
    }));
    res.json({ questions: safe, passThreshold: mod.passThreshold });
    return;
  }

  // For non-admins: shuffle options with the constraint that the correct
  // answer cannot occupy the same display position in consecutive questions.
  let previousCorrectPos = -1;
  const shuffled = questions.map((q) => {
    const options = JSON.parse(q.options) as string[];
    const indexed = options.map((opt: string, i: number) => ({ opt, originalIndex: i }));

    let result: typeof indexed;
    let correctPos: number;
    let attempts = 0;

    do {
      // Fisher-Yates shuffle
      result = [...indexed];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      correctPos = result.findIndex((r) => r.originalIndex === q.correctIndex);
      attempts++;
    } while (correctPos === previousCorrectPos && attempts < 20);

    previousCorrectPos = correctPos;

    return {
      id: q.id,
      question: q.question,
      options: result.map((r) => r.opt),
      // Send the mapping so the frontend can send back original indices
      _map: result.map((r) => r.originalIndex),
    };
  });

  res.json({ questions: shuffled, passThreshold: mod.passThreshold });
}

export async function createQuestion(req: Request, res: Response): Promise<void> {
  const mod = await prisma.trainingModule.findUnique({ where: { slug: req.params.slug } });
  if (!mod) { res.status(404).json({ error: 'Module not found' }); return; }

  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const { question, options, correctIndex, explanation, hint } = parsed.data;

  const q = await prisma.assessmentQuestion.create({
    data: {
      moduleId: mod.id,
      question,
      options: JSON.stringify(options),
      correctIndex,
      explanation: explanation || null,
      hint: hint || null,
    },
  });

  await logActivity(req, 'CREATE', 'ASSESSMENT_QUESTION', q.id, question.substring(0, 50));
  res.status(201).json({ question: { ...q, options: JSON.parse(q.options) } });
}

export async function updateQuestion(req: Request, res: Response): Promise<void> {
  const existing = await prisma.assessmentQuestion.findUnique({ where: { id: req.params.questionId } });
  if (!existing) { res.status(404).json({ error: 'Question not found' }); return; }

  const parsed = questionSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.question !== undefined) data.question = parsed.data.question;
  if (parsed.data.options !== undefined) data.options = JSON.stringify(parsed.data.options);
  if (parsed.data.correctIndex !== undefined) data.correctIndex = parsed.data.correctIndex;
  if (parsed.data.explanation !== undefined) data.explanation = parsed.data.explanation || null;
  if (parsed.data.hint !== undefined) data.hint = parsed.data.hint || null;

  const q = await prisma.assessmentQuestion.update({ where: { id: req.params.questionId }, data });
  await logActivity(req, 'UPDATE', 'ASSESSMENT_QUESTION', q.id, q.question.substring(0, 50));
  res.json({ question: { ...q, options: JSON.parse(q.options) } });
}

export async function deleteQuestion(req: Request, res: Response): Promise<void> {
  const existing = await prisma.assessmentQuestion.findUnique({ where: { id: req.params.questionId } });
  if (!existing) { res.status(404).json({ error: 'Question not found' }); return; }

  await prisma.assessmentQuestion.delete({ where: { id: req.params.questionId } });
  await logActivity(req, 'DELETE', 'ASSESSMENT_QUESTION', existing.id, existing.question.substring(0, 50));
  res.json({ message: 'Question deleted' });
}

export async function updatePassThreshold(req: Request, res: Response): Promise<void> {
  const mod = await prisma.trainingModule.findUnique({ where: { slug: req.params.slug } });
  if (!mod) { res.status(404).json({ error: 'Module not found' }); return; }

  const schema = z.object({ passThreshold: z.number().int().min(1).max(100) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Pass threshold must be between 1 and 100' });
    return;
  }

  await prisma.trainingModule.update({
    where: { id: mod.id },
    data: { passThreshold: parsed.data.passThreshold },
  });

  await logActivity(req, 'UPDATE', 'TRAINING_MODULE', mod.id, mod.title, `Pass threshold set to ${parsed.data.passThreshold}%`);
  res.json({ passThreshold: parsed.data.passThreshold });
}

// ============================================================
// ASSESSMENT SUBMISSION
// ============================================================

const assessSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string(),
    selectedIndex: z.number().int().min(0).max(3),
  })),
});

export async function submitAssessment(req: Request, res: Response): Promise<void> {
  const mod = await prisma.trainingModule.findUnique({ where: { slug: req.params.slug } });
  if (!mod) { res.status(404).json({ error: 'Module not found' }); return; }

  const parsed = assessSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const userId = req.user!.userId;
  const { answers } = parsed.data;

  // Fetch all questions for this module
  const questions = await prisma.assessmentQuestion.findMany({ where: { moduleId: mod.id } });
  if (questions.length === 0) {
    res.status(400).json({ error: 'This module has no assessment questions' });
    return;
  }

  const questionMap = new Map(questions.map((q) => [q.id, q]));

  // Validate all submitted answers refer to this module's questions
  for (const a of answers) {
    if (!questionMap.has(a.questionId)) {
      res.status(400).json({ error: `Question ${a.questionId} does not belong to this module` });
      return;
    }
  }

  if (answers.length !== questions.length) {
    res.status(400).json({ error: `Expected ${questions.length} answers, received ${answers.length}` });
    return;
  }

  // Score the assessment
  let correctCount = 0;
  const gradedAnswers = answers.map((a) => {
    const q = questionMap.get(a.questionId)!;
    const correct = a.selectedIndex === q.correctIndex;
    if (correct) correctCount++;
    return { questionId: a.questionId, selectedIndex: a.selectedIndex, correct };
  });

  const score = Math.round((correctCount / questions.length) * 100);
  const passed = score >= mod.passThreshold;

  // Record the attempt
  const attempt = await prisma.assessmentAttempt.create({
    data: {
      userId,
      moduleId: mod.id,
      score,
      totalQuestions: questions.length,
      correctCount,
      passed,
      answers: JSON.stringify(gradedAnswers),
    },
  });

  if (passed) {
    // Create training record (same as completeModule)
    const existing = await prisma.trainingRecord.findFirst({
      where: { userId, moduleId: mod.id },
    });
    if (!existing) {
      await prisma.trainingRecord.create({
        data: {
          userId,
          moduleId: mod.id,
          topic: mod.title,
          completedAt: new Date(),
          evidence: `Passed assessment with score ${score}% (threshold: ${mod.passThreshold}%)`,
          acknowledged: true,
        },
      });
    }
    await logActivity(req, 'PASS_ASSESSMENT', 'TRAINING_MODULE', mod.id, mod.title, `Score: ${score}%`);

    // Auto-create weekly competence evaluation obligation for this user+module
    const existingObligation = await prisma.scheduledObligation.findFirst({
      where: {
        type: 'COMPETENCE_EVALUATION',
        assigneeId: userId,
        linkedEntityId: mod.id,
        status: 'ACTIVE',
      },
    });
    if (!existingObligation) {
      const now = new Date();
      const obligation = await prisma.scheduledObligation.create({
        data: {
          type: 'COMPETENCE_EVALUATION',
          title: `Competence check — ${mod.title}`,
          standardCode: mod.standardCode || 'GENERAL',
          frequency: 'CUSTOM_DAYS',
          customDays: 7,
          anchorDate: now,
          assigneeId: userId,
          linkedEntityId: mod.id,
          linkedEntityType: 'TRAINING_MODULE',
        },
      });
      await prisma.obligationInstance.create({
        data: {
          obligationId: obligation.id,
          dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    }
  } else {
    // Remove any existing training record — forces retake
    await prisma.trainingRecord.deleteMany({
      where: { userId, moduleId: mod.id },
    });
    await logActivity(req, 'FAIL_ASSESSMENT', 'TRAINING_MODULE', mod.id, mod.title, `Score: ${score}% (required: ${mod.passThreshold}%)`);
  }

  res.json({
    attempt: {
      id: attempt.id,
      score,
      totalQuestions: questions.length,
      correctCount,
      passed,
      passThreshold: mod.passThreshold,
    },
  });
}

export async function listMyAttempts(req: Request, res: Response): Promise<void> {
  const mod = await prisma.trainingModule.findUnique({ where: { slug: req.params.slug } });
  if (!mod) { res.status(404).json({ error: 'Module not found' }); return; }

  const attempts = await prisma.assessmentAttempt.findMany({
    where: { userId: req.user!.userId, moduleId: mod.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, score: true, totalQuestions: true, correctCount: true, passed: true, createdAt: true },
  });

  res.json({ attempts });
}
