'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { FileText } from 'lucide-react';

type TranscriptRow = {
  id: string;
  meeting_id: string;
  file_name: string;
  file_type: string;
  content: string;
  created_at?: string;
};

type Props = {
  meetingId: string;
};

export default function MeetingTranscriptReferences({ meetingId }: Props) {
  const [rows, setRows] = useState<TranscriptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('transcripts')
        .select('id, meeting_id, file_name, file_type, content, created_at')
        .eq('meeting_id', meetingId)
        .order('id', { ascending: false });

      if (error) {
        console.error('Failed to fetch transcripts', error);
        setRows([]);
      } else {
        const nextRows = (data || []) as TranscriptRow[];
        setRows(nextRows);
        setSelectedId(null);
      }

      setLoading(false);
    };

    run();
  }, [meetingId]);

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) || null, [rows, selectedId]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-lg font-semibold text-slate-900">Uploaded Files (Clickable References)</h3>

      {loading ? (
        <p className="text-sm text-gray-500 mt-2">Loading uploaded files...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500 mt-2">No transcripts linked to this meeting.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-gray-600">Files</div>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
              {rows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => setSelectedId((prev) => (prev === row.id ? null : row.id))}
                  className={`w-full text-left p-3 hover:bg-gray-50 transition ${selectedId === row.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''}`}
                  title={selectedId === row.id ? `Hide ${row.file_name}` : `Open ${row.file_name}`}
                  aria-label={selectedId === row.id ? `Hide ${row.file_name}` : `Open ${row.file_name}`}
                >
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{row.file_name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {row.file_type || 'txt'}
                        {row.created_at ? ` • ${new Date(row.created_at).toLocaleString()}` : ''}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-gray-600">File Preview</div>
            <div className="p-3">
              {selected ? (
                <div>
                  <p className="text-sm font-semibold text-slate-900 mb-2">{selected.file_name}</p>
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 text-slate-100 text-xs p-3">
{selected.content}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Select a text file to open it. Click the same file again to close it.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
