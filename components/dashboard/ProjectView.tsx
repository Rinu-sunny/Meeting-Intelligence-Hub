'use client';

import React, { useState } from 'react';
import { Meeting } from '@/lib/types';
import ConflictAnalysis from '@/components/dashboard/ConflictAnalysis';
import FileNavigator from '@/components/dashboard/FileNavigator';
import MeetingInsightsPanel from '@/components/analysis/MeetingInsightsPanel';
import SentimentPanel from '@/components/analysis/SentimentPanel';

interface ProjectViewProps {
  projectName: string;
  meetings: Meeting[];
  onMeetingDeleted?: (meetingId: string) => void;
}

export default function ProjectView({ projectName, meetings, onMeetingDeleted }: ProjectViewProps) {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId);

  const handleDeleteMeeting = (meetingId: string) => {
    // Update local meetings list by filtering out deleted meeting
    if (onMeetingDeleted) {
      onMeetingDeleted(meetingId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Project Title */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{projectName}</h1>
        <p className="text-gray-500 mt-1">
          {meetings.filter((m) => (m.project_group || 'General') === projectName).length} files
        </p>
      </div>

      {/* Conflict Analysis for this Project */}
      <ConflictAnalysis projectName={projectName} meetings={meetings} />

      {/* File Navigator and Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* File Navigator Sidebar */}
        <div className="lg:col-span-1">
          <FileNavigator
            projectName={projectName}
            meetings={meetings}
            selectedMeetingId={selectedMeetingId}
            onSelectMeeting={setSelectedMeetingId}
            onDeleteMeeting={handleDeleteMeeting}
          />
        </div>

        {/* Meeting Content */}
        <div className="lg:col-span-2">
          {selectedMeeting ? (
            <div className="space-y-6">
              {/* Meeting Title */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedMeeting.name}</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Created {new Date(selectedMeeting.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* Meeting Panels */}
              <MeetingInsightsPanel meetingId={selectedMeeting.id} meetingName={selectedMeeting.name} />
              <SentimentPanel meetingId={selectedMeeting.id} />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
              <p className="text-gray-500 text-lg">Select a file to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
