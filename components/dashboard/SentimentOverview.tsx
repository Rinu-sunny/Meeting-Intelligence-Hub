'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { AlertCircle, TrendingUp } from 'lucide-react';

type SentimentData = {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
};

interface SentimentOverviewProps {
  projectName?: string;
}

export default function SentimentOverview({ projectName }: SentimentOverviewProps) {
  const [sentimentData, setSentimentData] = useState<SentimentData>({
    positive: 0,
    neutral: 0,
    negative: 0,
    total: 0,
  });
  const [currentMeetings, setCurrentMeetings] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSentimentOverview();
  }, [projectName]);

  const fetchSentimentOverview = async () => {
    try {
      setLoading(true);

      let sentimentQuery = supabase.from('sentiment_data').select('label, meeting_id');

      // If project name is provided, filter by project
      if (projectName) {
        // First get all meetings for this project
        const { data: projectMeetings, error: meetingsError } = await supabase
          .from('meetings')
          .select('id')
          .eq('project_group', projectName);

        if (meetingsError) {
          console.error('Failed to fetch project meetings:', meetingsError);
          return;
        }

        const meetingIds = (projectMeetings || []).map((m) => m.id);

        if (meetingIds.length === 0) {
          setSentimentData({ positive: 0, neutral: 0, negative: 0, total: 0 });
          setCurrentMeetings(0);
          return;
        }

        // Fetch sentiment data for these meetings
        const { data: sentimentRows, error: sentimentError } = await supabase
          .from('sentiment_data')
          .select('label')
          .in('meeting_id', meetingIds);

        if (sentimentError) {
          console.error('Failed to fetch sentiment data:', sentimentError);
          return;
        }

        // Count by sentiment label
        const counts = {
          positive: 0,
          neutral: 0,
          negative: 0,
        };

        (sentimentRows || []).forEach((row) => {
          if (row.label === 'positive') counts.positive++;
          else if (row.label === 'neutral') counts.neutral++;
          else if (row.label === 'negative') counts.negative++;
        });

        const total = counts.positive + counts.neutral + counts.negative;

        setSentimentData({
          positive: counts.positive,
          neutral: counts.neutral,
          negative: counts.negative,
          total: total,
        });

        setCurrentMeetings(meetingIds.length);
      } else {
        // Global sentiment data (no project filter)
        const { data: sentimentRows, error: sentimentError } = await supabase
          .from('sentiment_data')
          .select('label');

        if (sentimentError) {
          console.error('Failed to fetch sentiment data:', sentimentError);
          return;
        }

        // Count by sentiment label
        const counts = {
          positive: 0,
          neutral: 0,
          negative: 0,
        };

        (sentimentRows || []).forEach((row) => {
          if (row.label === 'positive') counts.positive++;
          else if (row.label === 'neutral') counts.neutral++;
          else if (row.label === 'negative') counts.negative++;
        });

        const total = counts.positive + counts.neutral + counts.negative;

        setSentimentData({
          positive: counts.positive,
          neutral: counts.neutral,
          negative: counts.negative,
          total: total,
        });

        // Fetch current meetings count (meetings created today or recently active)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: recentMeetings, error: meetingsError } = await supabase
          .from('meetings')
          .select('id')
          .gte('created_at', today.toISOString());

        if (!meetingsError) {
          setCurrentMeetings((recentMeetings || []).length);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse bg-gray-100 rounded-2xl p-6 h-32" />;
  }

  const conflictPercentage = sentimentData.total > 0
    ? Math.round((sentimentData.negative / sentimentData.total) * 100)
    : 0;

  const positivePercentage = sentimentData.total > 0
    ? Math.round((sentimentData.positive / sentimentData.total) * 100)
    : 0;

  const neutralPercentage = sentimentData.total > 0
    ? Math.round((sentimentData.neutral / sentimentData.total) * 100)
    : 0;

  // SVG Pie Chart
  const getArc = (start: number, end: number, radius: number) => {
    const startRad = (start * Math.PI) / 180;
    const endRad = (end * Math.PI) / 180;
    const x1 = radius * Math.cos(startRad);
    const y1 = radius * Math.sin(startRad);
    const x2 = radius * Math.cos(endRad);
    const y2 = radius * Math.sin(endRad);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M 0 0 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  const positiveAngle = (positivePercentage / 100) * 360;
  const neutralAngle = (neutralPercentage / 100) * 360;
  const negativeAngle = 360 - positiveAngle - neutralAngle;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      {/* Sentiment Pie Chart */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-4">
          Overall Sentiment Distribution
        </h2>
        <div className="flex items-center justify-center gap-8">
          {/* Pie Chart SVG */}
          <svg width="120" height="120" viewBox="-60 -60 120 120" className="shrink-0">
            {/* Positive (Green) */}
            <path
              d={getArc(0, positiveAngle, 50)}
              fill="#10b981"
              className="drop-shadow-sm"
            />
            {/* Neutral (Yellow) */}
            <path
              d={getArc(positiveAngle, positiveAngle + neutralAngle, 50)}
              fill="#facc15"
              className="drop-shadow-sm"
            />
            {/* Negative (Red) */}
            <path
              d={getArc(positiveAngle + neutralAngle, 360, 50)}
              fill="#ef4444"
              className="drop-shadow-sm"
            />
          </svg>

          {/* Legend */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-gray-700">Green - Positive ({positivePercentage}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="text-gray-700">Yellow - Neutral ({neutralPercentage}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-gray-700">Red - Negative ({conflictPercentage}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Conflict Percentage Card */}
      <div className="bg-linear-to-br from-red-50 to-red-100 rounded-2xl border border-red-200 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-2">
              Conflict Areas
            </p>
            <p className="text-4xl font-bold text-red-900">{conflictPercentage}%</p>
            <p className="text-xs text-red-700 mt-2">
              {sentimentData.negative} of {sentimentData.total} segments
            </p>
          </div>
          <AlertCircle className="w-10 h-10 text-red-400 shrink-0" />
        </div>
      </div>

      {/* Current Meetings Card */}
      <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-2">
              Active Meetings (Today)
            </p>
            <p className="text-4xl font-bold text-blue-900">{currentMeetings}</p>
            <p className="text-xs text-blue-700 mt-2">
              Total transcripts analyzed
            </p>
          </div>
          <TrendingUp className="w-10 h-10 text-blue-400 shrink-0" />
        </div>
      </div>
    </div>
  );
}
