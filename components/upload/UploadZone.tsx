'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getAIAnalysis } from '@/lib/ai/engine';
import { Upload, FileText, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

type ActionItem = {
  who: string;
  what: string;
  due_date: string;
};

export default function UploadZone() {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'success'>('idle');

  const validateAndAddFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    setError(null);
    setStatus('idle');

    const validFiles: File[] = [];
    Array.from(selectedFiles).forEach((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension === 'vtt' || extension === 'txt') {
        validFiles.push(file);
      } else {
        setError(`"${file.name}" is not supported. Please use .txt or .vtt.`);
      }
    });

    setFiles((prev: File[]) => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev: File[]) => prev.filter((_: File, i: number) => i !== index));
  };

  const saveActionItems = async (meetingId: string, actionItems: ActionItem[]) => {
    if (!actionItems.length) return;

    const payload = actionItems.map((item) => ({
      meeting_id: meetingId,
      type: 'action_item',
      content: item.what,
      assignee: item.who,
      due_date: item.due_date,
    }));

    const { error: insightsError } = await supabase.from('insights').insert(payload);
    if (insightsError) throw insightsError;
  };

  const handleProcessTranscripts = async () => {
    setStatus('uploading');
    setError(null);
    
    try {
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `transcripts/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('transcripts')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const content = await file.text();
        const wordCount = content.split(/\s+/).length;

        const { data: meeting, error: meetingError } = await supabase
          .from('meetings')
          .insert([{ 
            name: file.name.replace(/\.[^/.]+$/, ""), 
            word_count: wordCount,
            file_path: filePath 
          }])
          .select()
          .single();

        if (meetingError) throw meetingError;

        setStatus('analyzing');
        const analysis = await getAIAnalysis(content);

        if (analysis.decisions) {
          const decisionsData = analysis.decisions.map((d: string) => ({
            meeting_id: meeting.id,
            type: 'decision',
            content: d
          }));
          await supabase.from('insights').insert(decisionsData);
        }

        if (analysis.action_items) {
          await saveActionItems(meeting.id, analysis.action_items);
        }
      }

      setStatus('success');
      setFiles([]);
    } catch (err: unknown) {
      console.error("Processing Error:", err);
      setError(err instanceof Error ? err.message : 'Something went wrong during processing.');
      setStatus('idle');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div 
        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center transition-colors ${
          status === 'uploading' ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-300'
        }`}
      >
        <Upload className={`w-12 h-12 mb-4 ${status === 'uploading' ? 'text-blue-500 animate-bounce' : 'text-gray-400'}`} />
        
        <h3 className="text-lg font-semibold text-gray-900">Upload Transcripts</h3>
        <p className="text-sm text-gray-500 mb-6 text-center">Drag and drop your .txt or .vtt meeting logs here</p>

        <input 
          type="file" 
          multiple 
          accept=".txt,.vtt" 
          className="hidden" 
          id="file-input"
          onChange={(e) => validateAndAddFiles(e.target.files)}
          disabled={status !== 'idle' && status !== 'success'}
        />
        <label 
          htmlFor="file-input" 
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium cursor-pointer hover:bg-indigo-700 transition shadow-md active:scale-95"
        >
          Select Files
        </label>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg flex items-center gap-3">
          <AlertCircle size={20} />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {status === 'success' && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 text-green-600 rounded-lg flex items-center gap-3">
          <CheckCircle2 size={20} />
          <p className="text-sm font-medium">Processing complete! Your insights are ready.</p>
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-8 space-y-3">
          <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Queue ({files.length})</h4>
          {files.map((file: File, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-xl">
              <div className="flex items-center gap-3">
                <FileText className="text-indigo-400" size={20} />
                <div>
                  <p className="text-sm font-semibold text-gray-800 truncate max-w-[200px]">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              {status === 'idle' && (
                <button
                  onClick={() => removeFile(idx)}
                  className="text-gray-400 hover:text-red-500 transition"
                  aria-label={`Remove ${file.name}`}
                  title={`Remove ${file.name}`}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          ))}

          <button 
            onClick={handleProcessTranscripts}
            disabled={status === 'uploading' || status === 'analyzing'}
            className="w-full mt-6 py-4 bg-gray-900 text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-black transition disabled:bg-gray-400 shadow-xl"
          >
            {(status === 'uploading' || status === 'analyzing') ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                {status === 'uploading' ? 'Uploading to Supabase...' : 'Analyzing...'}
              </>
            ) : (
              'Start Intelligent Processing'
            )}
          </button>
        </div>
      )}
    </div>
  );
}