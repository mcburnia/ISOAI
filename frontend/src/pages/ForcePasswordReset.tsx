import { useState, FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import api from '../api/client';
import { Lock } from 'lucide-react';

export default function ForcePasswordReset() {
  const { user, logout, mustChangePassword, setMustChangePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If not logged in, go to login
  if (!user) return <Navigate to="/login" replace />;

  // If no password change required, go to dashboard
  if (!mustChangePassword) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from your temporary password');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/force-change-password', {
        currentPassword,
        newPassword,
      });
      // Update token with the fresh one
      localStorage.setItem('token', res.data.token);
      // Clear the forced reset flag
      setMustChangePassword(false);
      // Reload to pick up new token and redirect to app
      window.location.href = '/';
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
            KEEP<span className="text-kmi-bright">ME</span>ISO<span className="text-kmi-bright">.COM</span>
          </h1>
          <p className="text-sm text-muted-foreground">Integrated Management System</p>
        </div>

        <div className="bg-card rounded-lg border border-border shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Set Your Password</h2>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Welcome{user?.name ? `, ${user.name}` : ''}! For security, you must change your
            temporary password before continuing.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="currentPassword"
              label="Temporary Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter the password from your invitation"
              required
              autoComplete="current-password"
            />
            <Input
              id="newPassword"
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
              required
              autoComplete="new-password"
            />
            <Input
              id="confirmPassword"
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              required
              autoComplete="new-password"
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Changing Password...' : 'Set Password & Continue'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={logout}
              className="text-sm text-muted-foreground hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
