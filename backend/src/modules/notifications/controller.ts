import { Request, Response } from 'express';
import { prisma } from '../../prisma';

// GET /api/notifications
// Returns all notifications for the current user, unread first.
export async function listNotifications(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId as string;

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
    take: 50,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  res.json({ notifications, unreadCount });
}

// PATCH /api/notifications/:id/read
export async function markRead(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const id = req.params.id as string;

  const notification = await prisma.notification.findFirst({
    where: { id, userId },
  });

  if (!notification) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }

  await prisma.notification.update({
    where: { id },
    data: { read: true },
  });

  res.json({ ok: true });
}

// PATCH /api/notifications/read-all
export async function markAllRead(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });

  res.json({ ok: true });
}
