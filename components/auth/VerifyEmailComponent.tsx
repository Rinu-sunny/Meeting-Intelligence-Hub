'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '../ui/Alert';
import { Button } from '../ui/Button';

export function VerifyEmailComponent() {
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        // The email verification happens via the link sent to user's email
        // Supabase handles the verification automatically when user clicks the link
        // This component just shows the status
        
        // Check if this is a verification callback
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          // Verification successful
          setSuccess(true);
          setTimeout(() => {
            router.push('/auth/login');
          }, 3000);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsVerifying(false);
      }
    };

    // Small delay to let Supabase process
    const timer = setTimeout(verifyEmail, 1000);
    return () => clearTimeout(timer);
  }, [router]);

  if (isVerifying) {
    return (
      <div className="w-full max-w-md mx-auto p-6 text-center">
        <p className="text-gray-600">Verifying your email...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto p-6">
        <Alert className="border-green-500 bg-green-50">
          <AlertDescription className="text-green-800">
            ✓ Email verified successfully! Redirecting to sign in...
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-md mx-auto p-6 space-y-4">
        <Alert className="border-red-500 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
        <Button className="w-full">
          <a href="/auth/login">Back to Sign In</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 text-center space-y-4">
      <h2 className="text-2xl font-bold">Verify Your Email</h2>
      <p className="text-gray-600">
        We've sent a verification link to your email address. Click the link to confirm your account.
      </p>
      <p className="text-sm text-gray-500">
        Once verified, you'll be able to sign in.
      </p>
    </div>
  );
}
