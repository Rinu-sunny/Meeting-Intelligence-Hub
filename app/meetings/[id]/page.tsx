'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import MeetingInsightsPanel from '@/components/analysis/MeetingInsightsPanel';
import SentimentPanel from '@/components/analysis/SentimentPanel';
import MeetingTranscriptReferences from '@/components/analysis/MeetingTranscriptReferences';

type Meeting = {
  id: string;
  name: string;
  word_count: number;
  created_at: string;
};

export default function MeetingDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const meetingId = params?.id;

  const [user, setUser] = useState<any>(null);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);

  // Check auth first
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.push('/auth/login');
          return;
        }
        setUser(authUser);
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/auth/login');
      } finally {
        setAuthChecking(false);
      }
    };

    checkAuth();
  }, [router]);

  // Fetch meeting only if authenticated
  useEffect(() => {
    const run = async () => {
      if (!meetingId || !user || authChecking) return;
      setLoading(true);

      const { data, error } = await supabase
        .from('meetings')
        .select('id, name, word_count, created_at')
        .eq('id', meetingId)
        .single();

      if (error) {
        console.error('Failed to fetch meeting', error);
        setMeeting(null);
      } else {
        setMeeting(data as Meeting);
      }

      setLoading(false);
    };

    run();
  }, [meetingId, user, authChecking]);

  // Show loading while checking auth
  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // No user found - already redirected, show nothing
  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <main className="min-h-screen p-6 sm:p-10 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <p className="text-sm text-gray-600">Loading meeting detail...</p>
        </div>
      </main>
    );
  }

  if (!meeting || !meetingId) {
    return (
      <main className="min-h-screen p-6 sm:p-10 bg-gray-50">
        <div className="max-w-6xl mx-auto space-y-4">
          <p className="text-sm text-gray-600">Meeting not found.</p>
          <Link href="/dashboard" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 sm:p-10 bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-600">Meeting Detail</p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">{meeting.name}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {meeting.word_count} words • {new Date(meeting.created_at).toLocaleString()}
          </p>
        </div>

        <MeetingTranscriptReferences meetingId={meetingId} />
        <MeetingInsightsPanel meetingId={meetingId} meetingName={meeting.name} />
        <SentimentPanel meetingId={meetingId} />
      </div>
    </main>
  );
}
