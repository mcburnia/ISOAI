import { Request } from 'express';
import { prisma } from '../prisma';

// Simple in-memory cache for user names to avoid repeated lookups
const nameCache = new Map<string, string>();

async function resolveUserName(userId: string): Promise<string> {
  if (nameCache.has(userId)) return nameCache.get(userId)!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  const name = user?.name ?? 'Unknown';
  nameCache.set(userId, name);
  return name;
}

export async function logActivity(
  req: Request,
  action: string,
  entity: string,
  entityId?: string,
  entityName?: string,
  details?: string,
): Promise<void> {
  try {
    const userId = req.user?.userId ?? 'system';
    const userName = userId !== 'system' ? await resolveUserName(userId) : 'System';
    await prisma.activityLog.create({
      data: { userId, userName, action, entity, entityId, entityName, details },
    });
  } catch (err) {
    // Never let audit logging break the main operation
    console.error('Failed to write audit log:', err);
  }
}
