'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/Tooltip';

interface MeetingSummaryCardProps {
  meeting: {
    id: string;
    name: string;
    summary?: string | null;
    created_at: string;
    word_count: number;
    speaker_count: number;
  };
  onMeetingClick?: (meetingId: string) => void;
}

export function MeetingSummaryCard({ meeting, onMeetingClick }: MeetingSummaryCardProps) {
  const date = new Date(meeting.created_at);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <TooltipProvider>
      <div
        onClick={() => onMeetingClick?.(meeting.id)}
        className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
      >
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 truncate flex-1">{meeting.name}</h3>
          <span className="text-xs text-gray-500 ml-2 shrink-0">{formattedDate}</span>
        </div>

        {meeting.summary && (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-sm text-gray-600 line-clamp-2 mb-3">{meeting.summary}</p>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-sm">{meeting.summary}</p>
            </TooltipContent>
          </Tooltip>
        )}

        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>👥 {meeting.speaker_count || 0} participants</span>
          <span>📄 {Math.round(meeting.word_count / 1000)}k words</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
