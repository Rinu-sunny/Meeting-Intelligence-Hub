'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ChevronDown, ChevronRight, FileText, Home } from 'lucide-react';
import MeetingInsightsPanel from '@/components/analysis/MeetingInsightsPanel';
import SentimentPanel from '@/components/analysis/SentimentPanel';
import SentimentOverview from './SentimentOverview';

type Meeting = {
  id: string;
  name: string;
  word_count: number;
  created_at: string;
  project_group: string;
};

export default function FolderView() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      
      // Get authenticated user to get access token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No authenticated session');
        return;
      }

      // Fetch meetings through API endpoint (with user auth)
      const response = await fetch('/api/meetings', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch meetings:', response.statusText);
        return;
      }

      const { meetings: data } = await response.json() as { meetings: Meeting[] };
      setMeetings(data || []);
      
      // Extract unique projects, sorted
      const uniqueProjects = Array.from(
        new Set((data || []).map((m: Meeting) => m.project_group || 'General'))
      ).sort() as string[];
      setProjects(uniqueProjects);

      // Auto-expand first project
      if (uniqueProjects.length > 0) {
        setSelectedProject(uniqueProjects[0]);
        setExpandedProjects(new Set([uniqueProjects[0]]));
        
        // Auto-select first meeting
        const firstMeeting = (data || []).find((m: Meeting) => (m.project_group || 'General') === uniqueProjects[0]);
        if (firstMeeting) {
          setSelectedMeetingId(firstMeeting.id);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleProject = (project: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(project)) {
      newExpanded.delete(project);
    } else {
      newExpanded.add(project);
    }
    setExpandedProjects(newExpanded);
  };

  const handleSelectProject = (project: string) => {
    setSelectedProject(project);
    setSelectedMeetingId(null);
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(project)) {
      newExpanded.delete(project);
    } else {
      newExpanded.add(project);
    }
    setExpandedProjects(newExpanded);
  };

  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId) || null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => {
            setSelectedProject(null);
            setSelectedMeetingId(null);
          }}
          className="flex items-center gap-1 px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
        >
          <Home className="w-4 h-4" />
          All Files
        </button>
        {selectedProject && (
          <>
            <span className="text-gray-400">/</span>
            <span className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-900 font-medium">
              {selectedProject}
            </span>
          </>
        )}
        {selectedMeeting && (
          <>
            <span className="text-gray-400">/</span>
            <span className="px-3 py-1 rounded-lg bg-gray-100 text-gray-900 font-medium truncate max-w-xs">
              {selectedMeeting.name}
            </span>
          </>
        )}
      </div>

      {/* Sentiment Overview */}
      <SentimentOverview />

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* File Navigator Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 h-fit sticky top-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-4 px-3">Files</h2>
            
            {loading ? (
              <p className="text-xs text-gray-400 px-3 animate-pulse">Loading files...</p>
            ) : projects.length === 0 ? (
              <p className="text-xs text-gray-400 px-3">No files yet</p>
            ) : (
              <div className="space-y-2">
                {projects.map((project) => {
                  const isExpanded = expandedProjects.has(project);
                  const isSelected = selectedProject === project;
                  const projectFiles = meetings.filter((m) => (m.project_group || 'General') === project);
                  
                  return (
                    <div key={project}>
                      {/* Project Heading - Clickable */}
                      <button
                        onClick={() => handleSelectProject(project)}
                        className={`w-full text-left px-3 py-2 rounded-lg font-semibold text-xs uppercase tracking-wide flex items-center gap-2 transition-colors ${
                          isSelected
                            ? 'bg-indigo-100 text-indigo-900 hover:bg-indigo-150'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 shrink-0" />
                        )}
                        {project}
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                          isSelected ? 'bg-indigo-200 text-indigo-900' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {projectFiles.length}
                        </span>
                      </button>

                      {/* Expanded Files */}
                      {isExpanded && (
                        <div className="pl-4 space-y-1">
                          {projectFiles.map((meeting) => (
                            <button
                              key={meeting.id}
                              onClick={() => setSelectedMeetingId(meeting.id)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                                selectedMeetingId === meeting.id
                                  ? 'bg-indigo-100 text-indigo-900 border-l-2 border-indigo-500'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              <FileText className="w-3 h-3 shrink-0" />
                              <span className="truncate font-medium">{meeting.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3">
          {selectedMeetingId && selectedMeeting ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 h-fit space-y-6">
              {/* File Header */}
              <div className="pb-4 border-b border-gray-200">
                <h1 className="text-2xl font-bold text-gray-900">{selectedMeeting.name}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedMeeting.word_count} words • {selectedMeeting.project_group || 'General'}
                </p>
              </div>

              {/* Meeting Insights */}
              <MeetingInsightsPanel meetingId={selectedMeeting.id} meetingName={selectedMeeting.name} />

              {/* Sentiment Panel */}
              <SentimentPanel meetingId={selectedMeeting.id} />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 h-fit text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Select a file to view its analysis</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
