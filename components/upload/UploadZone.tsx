'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Upload, FileText, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import {
  createIdleProgress,
  createProgressForActiveFile,
  createProgressForCompletedFile,
  createProgressForTotal,
  computeDisplayedFileNumber,
  computeProgressPercent,
  type AnalysisProgress,
} from './progressUtils';

type ProcessedSummary = {
  meetingId: string;
  fileName: string;
  meetingName: string;
  meetingDate: string;
  speakerCount: number;
  segmentCount: number;
  averageSentiment: number;
  wordCount: number;
};

export default function UploadZone() {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'success'>('idle');
  const [projectGroup, setProjectGroup] = useState('');
  const [processedSummaries, setProcessedSummaries] = useState<ProcessedSummary[]>([]);
  const [existingProjects, setExistingProjects] = useState<string[]>([]);
  const [showProjectInput, setShowProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [progress, setProgress] = useState<AnalysisProgress>(createIdleProgress());

  // Fetch existing projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setExistingProjects([]);
          setShowProjectInput(false);
          setProjectGroup('');
          return;
        }

        const response = await fetch('/api/folders', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch projects:', response.statusText);
          setExistingProjects([]);
          setShowProjectInput(false);
          setProjectGroup('');
          return;
        }

        const { folders } = await response.json();
        const uniqueProjects = Array.from(new Set((folders || []).filter(Boolean) as string[])).sort();
        setExistingProjects(uniqueProjects);
        setShowProjectInput(false);
        if (uniqueProjects.length > 0 && !uniqueProjects.includes(projectGroup)) {
          setProjectGroup(uniqueProjects[0]);
        } else if (uniqueProjects.length === 0) {
          setProjectGroup('');
        }
      } catch (err) {
        console.error('Error fetching projects:', err);
        setExistingProjects([]);
        setShowProjectInput(false);
        setProjectGroup('');
      }
    };

    fetchProjects();
  }, []);

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

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (status === 'uploading' || status === 'analyzing') return;
    validateAndAddFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const removeFile = (index: number) => {
    setFiles((prev: File[]) => prev.filter((_: File, i: number) => i !== index));
  };

  const handleProcessTranscripts = async () => {
    setStatus('uploading');
    setError(null);
    const summaries: ProcessedSummary[] = [];
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    
    try {
      const selectedProject = projectGroup.trim();
      if (!selectedProject) {
        throw new Error('Please create a folder first.');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('You must be signed in to upload transcripts.');
      }

      setProgress(createProgressForTotal(files.length));

      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        const content = await file.text();
        
        // Show completed-file progress while the current file is being analyzed.
        setProgress(createProgressForActiveFile(fileIndex, files.length, file.name));

        // Keep the progress value moving while waiting for the AI/API response.
        progressTimer = setInterval(() => {
          setProgress((prev) => ({
            ...prev,
            currentFileProgress: Math.min(0.92, prev.currentFileProgress + 0.03),
          }));
        }, 450);

        console.log(`📄 Processing file: ${file.name} (${content.length} bytes)`);
        
        setStatus('analyzing');
        
        console.log('Sending to /api/analyze:', {
          transcriptLength: content.length,
          fileName: file.name,
          projectGroup: selectedProject,
          firstLine: content.split('\n')[0],
          lastLine: content.split('\n').pop(),
        });

        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            transcript: content,
            meetingName: file.name.replace(/\.[^/.]+$/, ''),
            fileName: file.name,
            projectGroup: selectedProject,
          }),
        });

        console.log('Response status:', response.status);
        const result = await response.json();
        console.log('Response data:', { 
          success: result.success, 
          meetingId: result.data?.id,
          segmentCount: result.data?.segment_count,
          sentimentSegments: result.data?.segment_count,
          avgSentiment: result.data?.avg_sentiment,
        });

        if (!response.ok) {
          if (progressTimer) {
            clearInterval(progressTimer);
            progressTimer = null;
          }
          const errorMessage = result?.error || result?.details || 'Failed to analyze transcript.';
          console.error('API Error response:', JSON.stringify(result, null, 2));
          console.error('API Error:', errorMessage);
          throw new Error(errorMessage);
        }

        if (progressTimer) {
          clearInterval(progressTimer);
          progressTimer = null;
        }

        summaries.push({
          meetingId: result?.data?.id,
          fileName: result?.data?.file_name || file.name,
          meetingName: result?.data?.name || file.name.replace(/\.[^/.]+$/, ''),
          meetingDate: result?.data?.meeting_date || new Date().toISOString(),
          speakerCount: result?.data?.speaker_count || 0,
          segmentCount: result?.data?.segment_count || 0,
          averageSentiment: Number(result?.data?.avg_sentiment || 0),
          wordCount: result?.data?.word_count || content.split(/\s+/).filter(Boolean).length,
        });

        // Mark current file as completed only after a successful response.
        setProgress(createProgressForCompletedFile(fileIndex, files.length, file.name));
      }

      setStatus('success');
      setFiles([]);
      setProcessedSummaries((prev) => [...summaries, ...prev]);
      setProgress(createIdleProgress());
    } catch (err: unknown) {
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
      console.error("Processing Error:", err);
      setError(err instanceof Error ? err.message : 'Something went wrong during processing.');
      setStatus('idle');
      setProgress(createIdleProgress());
    }
  };

  const progressPercent = computeProgressPercent(progress);
  const displayedFileNumber = computeDisplayedFileNumber(progress);

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div 
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center transition-colors ${
          status === 'uploading' ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-300'
        }`}
      >
        <Upload className={`w-12 h-12 mb-4 ${status === 'uploading' ? 'text-blue-500 animate-bounce' : 'text-gray-400'}`} />
        
        <h3 className="text-lg font-semibold text-gray-900">Upload Transcripts</h3>
        <p className="text-sm text-gray-500 mb-6 text-center">Drag and drop your .txt or .vtt meeting logs here</p>

        {/* Project Selection */}
        <div className="w-full max-w-sm mb-5">
          <label htmlFor="project-group" className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Project Folder
          </label>
          {showProjectInput ? (
            <div className="space-y-2">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Enter new folder name..."
                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const nextProjectName = newProjectName.trim();
                    if (nextProjectName) {
                      setProjectGroup(nextProjectName);
                      setExistingProjects((prev) => Array.from(new Set([...prev, nextProjectName])).sort());
                      setNewProjectName('');
                      setShowProjectInput(false);
                    }
                  }}
                  type="button"
                  className="flex-1 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition"
                >
                  Create Folder
                </button>
                <button
                  onClick={() => {
                    setNewProjectName('');
                    setShowProjectInput(false);
                  }}
                  type="button"
                  className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <select
                value={projectGroup || '__ADD_NEW__'}
                onChange={(e) => {
                  if (e.target.value === '__ADD_NEW__') {
                    setShowProjectInput(true);
                    return;
                  }
                  setProjectGroup(e.target.value);
                }}
                onClick={() => {
                  // When "+ Add New Folder" is the only/current option, onChange may not fire.
                  if ((projectGroup || '__ADD_NEW__') === '__ADD_NEW__') {
                    setShowProjectInput(true);
                  }
                }}
                title="Select a project folder"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                disabled={status === 'uploading' || status === 'analyzing'}
              >
                {existingProjects.map((project) => (
                  <option key={project} value={project}>
                    {project}
                  </option>
                ))}
                <option value="__ADD_NEW__">+ Add New Folder</option>
              </select>
            </div>
          )}
        </div>

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
        <div className="mt-4 p-6 bg-red-50 border-2 border-red-300 text-red-800 rounded-xl">
          <div className="flex items-start gap-4">
            <AlertCircle size={24} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-base font-bold mb-2">Error Processing Transcript</p>
              <p className="text-sm whitespace-pre-wrap wrap-break-word max-w-lg">{error}</p>
              <details className="mt-3 text-xs opacity-75">
                <summary className="cursor-pointer font-semibold hover:opacity-100">Show debugging info</summary>
                <pre className="mt-2 bg-white p-2 rounded border border-red-200 overflow-auto max-h-40 text-xs">
                  {error}
                </pre>
              </details>
            </div>
          </div>
        </div>
      )}

      {status === 'success' && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 text-green-600 rounded-lg flex items-center gap-3">
          <CheckCircle2 size={20} />
          <p className="text-sm font-medium">Processing complete! Your insights are ready.</p>
        </div>
      )}

      {/* Analysis Progress Bar */}
      {(status === 'uploading' || status === 'analyzing') && progress.totalFiles > 0 && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-blue-900">Processing files...</p>
              <p className="text-xs text-blue-700 mt-1">
                {displayedFileNumber} / {progress.totalFiles}
                {progress.currentFileName && ` - ${progress.currentFileName}`}
              </p>
            </div>
            <span className="text-sm font-bold text-blue-900">{progressPercent}%</span>
          </div>
          <progress
            className="w-full h-3 overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-blue-200 [&::-webkit-progress-value]:bg-linear-to-r [&::-webkit-progress-value]:from-blue-500 [&::-webkit-progress-value]:to-indigo-600 [&::-moz-progress-bar]:bg-linear-to-r [&::-moz-progress-bar]:from-blue-500 [&::-moz-progress-bar]:to-indigo-600"
            value={progressPercent}
            max={100}
          />
          {progress.isAnalyzing && (
            <p className="text-xs text-blue-600 mt-2 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Analyzing with AI engine...
            </p>
          )}
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
                  <p className="text-sm font-semibold text-gray-800 truncate max-w-50">{file.name}</p>
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
                {status === 'uploading' ? 'Processing...' : 'Analyzing...'}
              </>
            ) : (
              'Start Intelligent Processing'
            )}
          </button>
        </div>
      )}

      {processedSummaries.length > 0 && (
        <div className="mt-8">
          <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Transcript Summaries</h4>
          <div className="space-y-3">
            {processedSummaries.map((summary) => (
              <div key={`${summary.meetingId}-${summary.fileName}`} className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                <p className="text-sm font-semibold text-indigo-900">{summary.fileName}</p>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-indigo-800">
                  <p>
                    <span className="font-semibold">Meeting:</span> {summary.meetingName}
                  </p>
                  <p>
                    <span className="font-semibold">Meeting Date:</span>{' '}
                    {new Date(summary.meetingDate).toLocaleString()}
                  </p>
                  <p>
                    <span className="font-semibold">Speakers:</span> {summary.speakerCount}
                  </p>
                  <p>
                    <span className="font-semibold">Words:</span> {summary.wordCount}
                  </p>
                  <p>
                    <span className="font-semibold">Segments:</span> {summary.segmentCount}
                  </p>
                  <p>
                    <span className="font-semibold">Avg Sentiment:</span> {summary.averageSentiment.toFixed(2)}
                  </p>
                </div>
                <Link
                  href={`/meetings/${summary.meetingId}`}
                  className="inline-flex mt-3 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                >
                  Open detailed meeting view
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
