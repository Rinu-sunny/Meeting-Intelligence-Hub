'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { authService } from '@/lib/auth/service';

export default function SettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleLogout = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const { error: logoutError } = await authService.logout();

      if (logoutError) {
        setError(logoutError);
        setIsLoading(false);
        return;
      }

      setMessage('Logged out successfully');
      setTimeout(() => {
        router.push('/auth/login');
      }, 1000);
    } catch (err) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(
      'Are you sure you want to delete your account? This will permanently delete all your meetings, transcripts, and data. This action cannot be undone.'
    )) {
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const { error: deleteError } = await authService.deleteAccount();

      if (deleteError) {
        setError(deleteError);
        setIsLoading(false);
        return;
      }

      setMessage('Account deleted successfully');
      setTimeout(() => {
        router.push('/auth/signup');
      }, 1000);
    } catch (err) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold mb-8">Account Settings</h1>

        {error && (
          <Alert className="border-red-500 bg-red-50 mb-4">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {message && (
          <Alert className="border-green-500 bg-green-50 mb-4">
            <AlertDescription className="text-green-800">{message}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-2">Session</h2>
            <p className="text-sm text-gray-600 mb-4">
              Sign out of your account. You'll need to log back in to access your meetings and transcripts.
            </p>
            <Button
              onClick={handleLogout}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? 'Logging out...' : 'Logout'}
            </Button>
          </div>

          <hr className="my-6" />

          <div>
            <h2 className="text-lg font-semibold mb-2 text-red-600">Danger Zone</h2>
            <p className="text-sm text-gray-600 mb-4">
              Permanently delete your account and all associated data (meetings, transcripts, insights).
              <strong> This cannot be undone.</strong>
            </p>
            <Button
              onClick={handleDeleteAccount}
              disabled={isLoading}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              {isLoading ? 'Deleting...' : 'Delete Account'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
