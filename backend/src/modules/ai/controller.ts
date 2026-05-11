import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { env } from '../../config/env';
import { prisma } from '../../prisma';
import { buildTenantContext } from './contextBuilder';

const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .max(20)
    .default([]),
});

const SYSTEM_PROMPT_TEMPLATE = `You are an expert ISO compliance consultant embedded in Keep Me ISO, a compliance management platform.

You are assisting the compliance team at {ORG_NAME}. Here is their current compliance posture:

{TENANT_CONTEXT}

Your role is to help them with:
1. Gap analysis — identifying and prioritising compliance gaps based on their real control mapping data
2. Control explanations — interpreting ISO clauses in plain English with practical implementation guidance
3. Policy and procedure drafting — generating draft documents they can review and adapt
4. General Q&A — answering ISO compliance questions with specific reference to their situation

Guidelines:
- Be specific and practical. Reference the organisation's actual data (control counts, percentages, open items) when relevant.
- Prioritise the standards they have activated. If they ask about a standard not in their active list, note this.
- When drafting policy documents, produce complete, usable drafts — not outlines or summaries.
- When identifying gaps, be direct: name the specific clauses and suggest concrete next steps.
- Use British English throughout (organisation not organization, colour not color, etc.).
- Keep responses focused and well-structured. Use headings and bullet points where appropriate.
- Never invent compliance data. If you don't know something, say so clearly.`;

function buildSystemPrompt(orgContext: string, orgName: string): string {
  return SYSTEM_PROMPT_TEMPLATE
    .replace('{ORG_NAME}', orgName)
    .replace('{TENANT_CONTEXT}', orgContext);
}

// POST /api/ai/chat
// Streams the assistant response as Server-Sent Events.
export async function chat(req: Request, res: Response): Promise<void> {
  // Check API key is configured
  if (!env.anthropicApiKey) {
    res.status(503).json({
      error: 'AI Pilot not configured',
      detail: 'ANTHROPIC_API_KEY is not set. Add it to your .env file and restart the backend.',
    });
    return;
  }

  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', detail: parsed.error.flatten() });
    return;
  }

  const { message, history } = parsed.data;
  const userId = req.user!.userId as string;
  const tenantId = req.user!.tenantId as string;
  const schemaName = req.user!.schemaName as string;

  if (!tenantId || !schemaName) {
    res.status(400).json({ error: 'No tenant context' });
    return;
  }

  // Build tenant context (runs against tenant DB via prisma proxy)
  let tenantContext: string;
  try {
    tenantContext = await buildTenantContext(tenantId, schemaName, prisma as any);
  } catch (err: any) {
    console.error('[ai] Failed to build tenant context:', err.message);
    tenantContext = 'Unable to load live compliance data.';
  }

  // Extract org name from context for the prompt
  const orgNameMatch = tenantContext.match(/^Organisation: (.+)$/m);
  const orgName = orgNameMatch ? orgNameMatch[1] : 'the organisation';

  const systemPrompt = buildSystemPrompt(tenantContext, orgName);

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering if behind proxy

  const client = new Anthropic({ apiKey: env.anthropicApiKey });

  // Build messages array: history + new user message
  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  try {
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    });

    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        const data = JSON.stringify({ delta: chunk.delta.text });
        res.write(`data: ${data}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('[ai] Anthropic stream error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'AI request failed', detail: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
}

// GET /api/ai/status — lets the frontend check if AI is configured
export async function status(_req: Request, res: Response): Promise<void> {
  res.json({ configured: Boolean(env.anthropicApiKey) });
}
