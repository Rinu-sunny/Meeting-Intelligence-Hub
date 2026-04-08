'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Alert, AlertDescription } from '../ui/Alert';
import { authService } from '../../lib/auth/service';

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!email) {
      setError('Email is required');
      setIsLoading(false);
      return;
    }

    try {
      const { error: resetError } = await authService.resetPassword(email);

      if (resetError) {
        setError(resetError);
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setEmail('');
    } catch (err) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto p-6">
        <Alert className="border-green-500 bg-green-50 mb-4">
          <AlertDescription className="text-green-800">
            ✓ Check your email for a password reset link
          </AlertDescription>
        </Alert>
        <Button className="w-full">
          <Link href="/auth/login">Back to Sign In</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto space-y-4 p-6">
      <h2 className="text-2xl font-bold">Reset Password</h2>

      {error && (
        <Alert className="border-red-500 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-gray-600 text-sm">
        Enter your email address and we'll send you a link to reset your password.
      </p>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Sending...' : 'Send Reset Link'}
      </Button>

      <p className="text-center text-sm">
        <Link href="/auth/login" className="text-blue-600 hover:underline">
          Back to Sign In
        </Link>
      </p>
    </form>
  );
}
