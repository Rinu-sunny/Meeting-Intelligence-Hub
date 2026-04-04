'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import ChatInterface from '@/components/chat/ChatInterface';
import { FileText, Loader2 } from 'lucide-react';

type Meeting = {
  id: string;
  name: string;
  word_count: number;
  created_at: string;
};

export default function ChatPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const { data, error } = await supabase
          .from('meetings')
          .select('id, name, word_count, created_at')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setMeetings(data || []);
        if (data && data.length > 0) {
          setSelectedMeetingId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch meetings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-gray-600">Loading meetings...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Meeting Intelligence Chat</h1>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Meetings List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700">
                <h2 className="font-semibold text-white">Your Meetings</h2>
              </div>
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {meetings.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No meetings found. Upload a transcript to get started.
                  </div>
                ) : (
                  meetings.map((meeting) => (
                    <button
                      key={meeting.id}
                      onClick={() => setSelectedMeetingId(meeting.id)}
                      className={`w-full p-4 text-left transition-colors hover:bg-gray-50 ${
                        selectedMeetingId === meeting.id
                          ? 'bg-indigo-50 border-l-4 border-indigo-600'
                          : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <FileText className="w-4 h-4 text-indigo-600 mt-1 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate text-sm">
                            {meeting.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {meeting.word_count} words
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Chat Interface */}
          <div className="lg:col-span-3">
            {selectedMeetingId ? (
              <ChatInterface meetingId={selectedMeetingId} />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
                <p className="text-gray-500">Select a meeting to start chatting about its insights.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
