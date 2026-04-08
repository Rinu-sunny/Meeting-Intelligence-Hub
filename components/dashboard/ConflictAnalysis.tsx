'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { AlertCircle, TrendingUp, FileText } from 'lucide-react';
import { Meeting } from '@/lib/types';

interface ConflictAnalysisProps {
  projectName: string;
  meetings: Meeting[];
}

type SentimentStats = {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  fileCount: number;
};

export default function ConflictAnalysis({ projectName, meetings }: ConflictAnalysisProps) {
  const [stats, setStats] = useState<SentimentStats>({
    positive: 0,
    neutral: 0,
    negative: 0,
    total: 0,
    fileCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [projectName]);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Get all meetings in this project
      const projectMeetings = meetings.filter((m) => (m.project_group || 'General') === projectName);
      const projectMeetingIds = projectMeetings.map((m) => m.id);

      if (projectMeetingIds.length === 0) {
        setStats({
          positive: 0,
          neutral: 0,
          negative: 0,
          total: 0,
          fileCount: 0,
        });
        return;
      }

      // Fetch sentiment data for this project
      const { data: sentimentRows, error } = await supabase
        .from('sentiment_data')
        .select('label')
        .in('meeting_id', projectMeetingIds);

      if (error) {
        console.error('Failed to fetch sentiment data:', error);
        return;
      }

      // Count sentiment by label
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
      const conflictPercentage = total > 0 ? Math.round((counts.negative / total) * 100) : 0;

      setStats({
        positive: counts.positive,
        neutral: counts.neutral,
        negative: counts.negative,
        total: total,
        fileCount: projectMeetingIds.length,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-100 rounded-2xl p-6 h-32" />
        ))}
      </div>
    );
  }

  const conflictPercentage = stats.total > 0 ? Math.round((stats.negative / stats.total) * 100) : 0;
  
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

  const positivePercentage = stats.total > 0 ? Math.round((stats.positive / stats.total) * 100) : 0;
  const neutralPercentage = stats.total > 0 ? Math.round((stats.neutral / stats.total) * 100) : 0;

  const positiveAngle = (positivePercentage / 100) * 360;
  const neutralAngle = (neutralPercentage / 100) * 360;
  const negativeAngle = 360 - positiveAngle - neutralAngle;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Sentiment Distribution Pie Chart */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-4">
          Sentiment Distribution
        </h2>
        <div className="flex items-center justify-center gap-8">
          {/* Pie Chart SVG */}
          <svg width="120" height="120" viewBox="-60 -60 120 120" className="shrink-0">
            {/* Positive (Green) */}
            <path d={getArc(0, positiveAngle, 50)} fill="#10b981" className="drop-shadow-sm" />
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

      {/* Conflict Areas */}
      <div className="bg-linear-to-br from-red-50 to-red-100 rounded-2xl border border-red-200 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-2">
              Conflict Areas
            </p>
            <p className="text-4xl font-bold text-red-900">{conflictPercentage}%</p>
            <p className="text-xs text-red-700 mt-2">
              {stats.negative} of {stats.total} segments
            </p>
          </div>
          <AlertCircle className="w-10 h-10 text-red-400 shrink-0" />
        </div>
      </div>

      {/* Total Files in Folder */}
      <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-2">
              Files in Folder
            </p>
            <p className="text-4xl font-bold text-blue-900">{stats.fileCount}</p>
            <p className="text-xs text-blue-700 mt-2">
              Total transcripts
            </p>
          </div>
          <FileText className="w-10 h-10 text-blue-400 shrink-0" />
        </div>
      </div>
    </div>
  );
}
