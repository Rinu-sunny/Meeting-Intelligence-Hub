'use client';

import React, { useEffect, useState } from 'react';
import { BarChart3, CheckCircle2, Zap, Activity, Cloud, Cpu } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

type StatsData = {
  totalFiles: number;
  totalProjects: number;
  sentimentScore: number;
  aiServerStatus: 'connected' | 'disconnected';
  aiServerLatency: number;
};

type AIServerMode = 'local' | 'cloud';

export default function DashboardStats() {
  const [stats, setStats] = useState<StatsData>({
    totalFiles: 0,
    totalProjects: 0,
    sentimentScore: 85,
    aiServerStatus: 'disconnected',
    aiServerLatency: 0,
  });
  const [loading, setLoading] = useState(true);
  const [aiMode, setAiMode] = useState<AIServerMode>('local');

  useEffect(() => {
    // Load saved AI mode preference from localStorage
    const savedMode = localStorage.getItem('aiServerMode') as AIServerMode;
    if (savedMode) {
      setAiMode(savedMode);
    }

    // Migration already completed - skipping for now to avoid conflicts
    // Data is already associated with legacy user via email matching
    
    fetchStats();
    
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      // Get the current session with access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        console.warn('Failed to get session or no access token');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/dashboard/stats', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (!response.ok) {
        console.error('Failed to fetch stats:', response.status, response.statusText);
      } else {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAiMode = (mode: AIServerMode) => {
    setAiMode(mode);
    localStorage.setItem('aiServerMode', mode);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      {/* Total Projects Card (FIRST) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 text-sm font-medium mb-1">Total Projects</p>
            <p className="text-3xl font-bold text-gray-900">
              {loading ? '-' : stats.totalProjects}
            </p>
            <p className="text-xs text-gray-500 mt-2">Active folders</p>
          </div>
          <div className="p-3 bg-amber-100 rounded-lg">
            <CheckCircle2 className="text-amber-600" size={24} />
          </div>
        </div>
      </div>

      {/* Total Files Uploaded Card (SECOND) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 text-sm font-medium mb-1">Total Files</p>
            <p className="text-3xl font-bold text-gray-900">
              {loading ? '-' : stats.totalFiles}
            </p>
            <p className="text-xs text-gray-500 mt-2">Uploaded transcripts</p>
          </div>
          <div className="p-3 bg-blue-100 rounded-lg">
            <BarChart3 className="text-blue-600" size={24} />
          </div>
        </div>
      </div>

      {/* Team Sentiment Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 text-sm font-medium mb-1">Team Sentiment</p>
            <p className="text-3xl font-bold">
              <span className={stats.sentimentScore >= 80 ? 'text-green-600' : stats.sentimentScore >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                {loading ? '-' : `${stats.sentimentScore}%`}
              </span>
            </p>
            <p className="text-xs text-gray-500 mt-2">Health score</p>
          </div>
          <div className={`p-3 rounded-lg ${stats.sentimentScore >= 80 ? 'bg-green-100' : stats.sentimentScore >= 60 ? 'bg-yellow-100' : 'bg-red-100'}`}>
            <Zap className={stats.sentimentScore >= 80 ? 'text-green-600' : stats.sentimentScore >= 60 ? 'text-yellow-600' : 'text-red-600'} size={24} />
          </div>
        </div>
      </div>

      {/* AI Server Status Card - SWITCHABLE */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <p className="text-gray-600 text-sm font-medium">AI Server</p>
          <div className="text-xs font-semibold text-gray-500">Switch Mode</div>
        </div>

        {/* Toggle Buttons */}
        <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => toggleAiMode('local')}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-semibold transition-all ${
              aiMode === 'local'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Cpu size={12} className="inline mr-1" />
            Local
          </button>
          <button
            onClick={() => toggleAiMode('cloud')}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-semibold transition-all ${
              aiMode === 'cloud'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Cloud size={12} className="inline mr-1" />
            Cloud
          </button>
        </div>

        {/* Status Display */}
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full animate-pulse ${stats.aiServerStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
          <div>
            <p className="text-sm font-semibold">
              {loading ? 'Checking...' : aiMode === 'local' ? 'Ollama (G15)' : 'Groq API'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {stats.aiServerLatency > 0 ? `${stats.aiServerLatency}ms latency` : 'Status unknown'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
