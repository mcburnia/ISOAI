import { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { User, Lock, CheckCircle, AlertCircle } from 'lucide-react';

export default function Settings() {
  const { user, login } = useAuth();

  // Profile form
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMessage(null);
    try {
      const res = await api.patch('/auth/profile', { name, email });
      setProfileMessage({ type: 'success', text: 'Profile updated successfully' });
      // Re-fetch user data to update the sidebar/header
      if (res.data.user) {
        // Force a page reload to refresh auth context with new user data
        window.location.reload();
      }
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update profile' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
      setPasswordLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 6 characters' });
      setPasswordLoading(false);
      return;
    }

    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setPasswordMessage({ type: 'success', text: 'Password changed successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err.response?.data?.error || 'Failed to change password' });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Profile</h3>
          </div>
        </CardHeader>
        <CardContent>
          {profileMessage && (
            <div className={`mb-4 p-3 rounded-md flex items-center gap-2 text-sm ${
              profileMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}>
              {profileMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {profileMessage.text}
            </div>
          )}
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <Input
              id="name"
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className="text-sm text-muted-foreground">
              Role: <span className="font-medium text-foreground">{user?.role === 'ADMIN' ? 'Administrator' : 'User'}</span>
            </div>
            <Button type="submit" disabled={profileLoading}>
              {profileLoading ? 'Saving...' : 'Update Profile'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Change Password</h3>
          </div>
        </CardHeader>
        <CardContent>
          {passwordMessage && (
            <div className={`mb-4 p-3 rounded-md flex items-center gap-2 text-sm ${
              passwordMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}>
              {passwordMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {passwordMessage.text}
            </div>
          )}
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <Input
              id="currentPassword"
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
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
            <Button type="submit" disabled={passwordLoading}>
              {passwordLoading ? 'Changing...' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
