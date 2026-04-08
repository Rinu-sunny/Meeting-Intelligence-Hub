'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { BarChart3, FileText, ListChecks, Smile } from 'lucide-react';

type MeetingRow = {
  id: string;
  name: string;
  created_at: string;
  word_count: number;
};

type StatTileProps = {
  label: string;
  value: string | number;
  icon: React.ReactNode;
};

function StatTile({ label, value, icon }: StatTileProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
    </div>
  );
}

export default function DashboardOverview() {
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [transcriptCount, setTranscriptCount] = useState(0);
  const [actionItemCount, setActionItemCount] = useState(0);
  const [avgSentiment, setAvgSentiment] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [{ data: meetingRows }, { count: transcriptTotal }, { count: actionTotal }, { data: sentimentRows }] =
        await Promise.all([
          supabase
            .from('meetings')
            .select('id, name, created_at, word_count')
            .order('created_at', { ascending: false })
            .limit(8),
          supabase.from('transcripts').select('*', { count: 'exact', head: true }),
          supabase
            .from('insights')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'action_item'),
          supabase.from('sentiment_data').select('score').limit(500),
        ]);

      setMeetings((meetingRows || []) as MeetingRow[]);
      setTranscriptCount(transcriptTotal || 0);
      setActionItemCount(actionTotal || 0);

      const scores = (sentimentRows || []).map((r: any) => Number(r.score || 0));
      const avg = scores.length ? scores.reduce((acc, score) => acc + score, 0) / scores.length : 0;
      setAvgSentiment(avg);
    };

    load();
  }, []);

  const sentimentLabel = useMemo(() => {
    if (avgSentiment > 0.2) return 'Positive';
    if (avgSentiment < -0.2) return 'Negative';
    return 'Neutral';
  }, [avgSentiment]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Meetings" value={meetings.length} icon={<BarChart3 className="w-4 h-4 text-indigo-600" />} />
        <StatTile label="Transcripts" value={transcriptCount} icon={<FileText className="w-4 h-4 text-indigo-600" />} />
        <StatTile label="Action Items" value={actionItemCount} icon={<ListChecks className="w-4 h-4 text-indigo-600" />} />
        <StatTile
          label="Sentiment"
          value={`${sentimentLabel} (${avgSentiment.toFixed(2)})`}
          icon={<Smile className="w-4 h-4 text-indigo-600" />}
        />
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600">Recent Meetings</h3>
          <Link href="/dashboard" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Open Meeting Detail View
          </Link>
        </div>

        {meetings.length === 0 ? (
          <p className="text-sm text-gray-500">No meetings yet. Upload your first transcript below.</p>
        ) : (
          <div className="space-y-2">
            {meetings.map((meeting) => (
              <Link
                key={meeting.id}
                href={`/meetings/${meeting.id}`}
                className="block p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-200 transition"
              >
                <p className="text-sm font-semibold text-slate-900">{meeting.name}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {meeting.word_count} words • {new Date(meeting.created_at).toLocaleString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
