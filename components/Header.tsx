'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { authService } from '@/lib/auth/service';
import { useState } from 'react';
import { Triangle } from 'lucide-react';

export function Header() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      const { error } = await authService.signOut();
      if (!error) {
        router.push('/auth/login');
      }
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-indigo-100/80 bg-white/90 backdrop-blur">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-lg font-bold text-slate-900">
          <Triangle className="w-5 h-5 text-indigo-600 fill-indigo-200" />
          <span>Meeting Intelligence Hub</span>
        </Link>
        <nav className="flex items-center gap-2">
          {isAuthenticated && user && (
            <>
              <Link href="/dashboard" className="px-3 py-2 text-sm font-semibold rounded-lg text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                Dashboard
              </Link>
              <Link href="/upload" className="px-3 py-2 text-sm font-semibold rounded-lg text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                Upload
              </Link>
              <Link href="/chat" className="px-3 py-2 text-sm font-semibold rounded-lg text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                Assistant
              </Link>
            </>
          )}

          {isLoading ? (
            <div className="px-3 py-2 text-sm text-slate-500">...</div>
          ) : isAuthenticated && user ? (
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-indigo-100">
              <span className="text-sm font-medium text-slate-700">{user.email}</span>
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="px-3 py-2 text-sm font-semibold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSigningOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          ) : (
            <Link href="/auth/login" className="px-3 py-2 text-sm font-semibold rounded-lg text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
