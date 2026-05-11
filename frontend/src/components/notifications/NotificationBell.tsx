import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, AlertTriangle, Clock, Brain, RefreshCw } from 'lucide-react';
import api from '../../api/client';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; colour: string; label: string }> = {
  OBLIGATION_OVERDUE: {
    icon: <AlertTriangle className="w-4 h-4" />,
    colour: 'text-red-600',
    label: 'Overdue',
  },
  OBLIGATION_DUE: {
    icon: <Clock className="w-4 h-4" />,
    colour: 'text-kmi-coral',
    label: 'Due soon',
  },
  COMPETENCE_DUE: {
    icon: <Brain className="w-4 h-4" />,
    colour: 'text-kmi-navy',
    label: 'Competence check',
  },
  TRAINING_RENEWAL: {
    icon: <RefreshCw className="w-4 h-4" />,
    colour: 'text-amber-600',
    label: 'Training renewal',
  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // Silently ignore — bell should never crash the page
    }
  }

  useEffect(() => {
    fetchNotifications();
    // Poll every 2 minutes
    const interval = setInterval(fetchNotifications, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await api.patch('/notifications/read-all');
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  const overdue = notifications.filter((n) => n.type === 'OBLIGATION_OVERDUE');
  const dueSoon = notifications.filter((n) => n.type === 'OBLIGATION_DUE');
  const other = notifications.filter(
    (n) => n.type !== 'OBLIGATION_OVERDUE' && n.type !== 'OBLIGATION_DUE'
  );

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-kmi-coral text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-10 w-96 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
            <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No notifications</p>
              </div>
            ) : (
              <>
                {[...overdue, ...dueSoon, ...other].map((n) => {
                  const config = TYPE_CONFIG[n.type] ?? {
                    icon: <Bell className="w-4 h-4" />,
                    colour: 'text-muted-foreground',
                    label: n.type,
                  };
                  return (
                    <div
                      key={n.id}
                      onClick={() => !n.read && markRead(n.id)}
                      className={`px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors ${
                        !n.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 shrink-0 ${config.colour}`}>
                          {config.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${config.colour}`}>
                              {config.label}
                            </span>
                            {!n.read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-kmi-coral shrink-0" />
                            )}
                          </div>
                          <p className="text-sm font-medium text-foreground leading-snug">{n.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
