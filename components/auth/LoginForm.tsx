'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Alert, AlertDescription } from '../ui/Alert';
import { authService } from '../../lib/auth/service';

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!formData.email || !formData.password) {
      setError('Email and password are required');
      setIsLoading(false);
      return;
    }

    try {
      const { user, error: authError } = await authService.signIn(
        formData.email,
        formData.password
      );

      if (authError) {
        setError(authError);
        setIsLoading(false);
        return;
      }

      if (user) {
        router.push('/dashboard');
      }
    } catch (err) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-xl mx-auto space-y-5 rounded-3xl border border-white/80 bg-white/85 p-8 sm:p-10 shadow-2xl backdrop-blur"
    >
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-slate-800">Welcome Back</h2>
        <p className="text-sm text-slate-600">Sign in to continue to your Meeting Intelligence Hub dashboard.</p>
      </div>

      {error && (
        <Alert className="border-red-500 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          value={formData.email}
          onChange={handleChange}
          disabled={isLoading}
        />
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          value={formData.password}
          onChange={handleChange}
          disabled={isLoading}
        />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Signing In...' : 'Sign In'}
      </Button>

      <div className="flex justify-between text-sm">
        <Link href="/auth/signup" className="text-indigo-600 hover:text-indigo-700 hover:underline">
          Create Account
        </Link>
        <Link href="/auth/forgot-password" className="text-indigo-600 hover:text-indigo-700 hover:underline">
          Forgot Password?
        </Link>
      </div>
    </form>
  );
}
