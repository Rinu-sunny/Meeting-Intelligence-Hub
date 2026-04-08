'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type SentimentRow = {
  id: string;
  speaker_name: string;
  score: number;
  transcript_snippet?: string;
};

type Props = {
  meetingId: string;
};

export default function SentimentPanel({ meetingId }: Props) {
  const [rows, setRows] = useState<SentimentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        console.log('Fetching sentiment data for meetingId:', meetingId);
        const { data, error } = await supabase
          .from('sentiment_data')
          .select('*')
          .eq('meeting_id', meetingId);

        if (error) {
          console.error('❌ Supabase sentiment_data error:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          setRows([]);
        } else {
          console.log('✅ Sentiment data fetched:', data?.length || 0, 'rows');
          setRows((data || []) as SentimentRow[]);
        }
      } catch (err) {
        console.error('❌ Exception in sentiment fetch:', err);
        setRows([]);
      }
      setLoading(false);
    };

    run();
  }, [meetingId]);

  const labelFromScore = (score: number) => {
    if (score > 0.1) return 'positive';
    if (score < -0.1) return 'negative';
    return 'neutral';
  };

  const overallScore = rows.length
    ? rows.reduce((acc, row) => acc + Number(row.score || 0), 0) / rows.length
    : 0;

  const flagged = rows.filter((row) => labelFromScore(Number(row.score || 0)) === 'negative');

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Sentiment Analysis</h3>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : !rows.length ? (
        <p className="text-sm text-gray-500">No sentiment data available.</p>
      ) : (
        <div className="space-y-6">
          {/* Overall Stats */}
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <p className="text-xs font-semibold uppercase text-gray-600">Overall Sentiment</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{overallScore.toFixed(2)}</p>
            <p className="text-xs text-gray-600 mt-2">
              {labelFromScore(overallScore).toUpperCase()} • {rows.length} segments total
            </p>
          </div>

          {/* Sentiment Timeline */}
          <div>
            <p className="text-xs font-semibold uppercase text-gray-600 mb-2">Timeline</p>
            <div className="flex gap-1 flex-wrap">
              {rows.map((row) => {
                const label = labelFromScore(Number(row.score || 0));
                const bgClass =
                  label === 'positive'
                    ? 'bg-emerald-500'
                    : label === 'negative'
                    ? 'bg-rose-500'
                    : 'bg-amber-400';
                return (
                  <div
                    key={row.id}
                    className={`w-3 h-3 rounded-full ${bgClass}`}
                    title={`${label}: ${row.transcript_snippet?.substring(0, 50)}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Full Colored Transcript - ONE LINE PER SPEAKER */}
          <div>
            <p className="text-xs font-semibold uppercase text-gray-600 mb-3">Full Transcript</p>
            <div className="p-4 rounded-lg bg-white border border-gray-200 max-h-96 overflow-y-auto space-y-2">
              {rows.map((item, index) => {
                const label = labelFromScore(Number(item.score || 0));
                const bgClass =
                  label === 'positive'
                    ? 'bg-green-100 border-green-300'
                    : label === 'negative'
                    ? 'bg-red-100 border-red-300'
                    : 'bg-yellow-100 border-yellow-300';

                return (
                  <div key={item.id} className={`${bgClass} border rounded px-3 py-2`}>
                    <p className="text-xs leading-relaxed">
                      <span className="font-bold text-gray-800">{item.speaker_name}:</span>{' '}
                      <span className="text-gray-900">{item.transcript_snippet}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Flagged Negative Segments */}
          {flagged.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase text-gray-600 mb-2">
                Flagged Issues ({flagged.length})
              </p>
              <div className="space-y-2">
                {flagged.map((item) => (
                  <div key={item.id} className="p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-xs text-red-700 font-semibold mb-1">
                      {item.speaker_name}
                    </p>
                    <p className="text-sm text-red-900">{item.transcript_snippet}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
