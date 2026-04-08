'use client';

import React, { useMemo, useState } from 'react';
import { Search, ChevronDown, Trash2, Check } from 'lucide-react';
import { Meeting } from '@/lib/types';
import { supabase } from '@/lib/supabase/client';
import DeleteConfirmationModal from './DeleteConfirmationModal';

type SortOrder = 'latest' | 'earliest';

interface FileNavigatorProps {
  projectName: string;
  meetings: Meeting[];
  selectedMeetingId: string | null;
  onSelectMeeting: (id: string) => void;
  onDeleteMeeting: (id: string) => void;
}

export default function FileNavigator({
  projectName,
  meetings,
  selectedMeetingId,
  onSelectMeeting,
  onDeleteMeeting,
}: FileNavigatorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('latest');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'single' | 'bulk'>('single');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteMeeting = async (e: React.MouseEvent, meetingId: string) => {
    e.stopPropagation();
    setDeleteMode('single');
    setDeletingId(meetingId);
    setShowDeleteModal(true);
  };

  const handleBulkDelete = () => {
    if (selectedFiles.size === 0) return;
    setDeleteMode('bulk');
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('You must be signed in to delete files.');
      }

      if (deleteMode === 'single' && deletingId) {
        const response = await fetch(`/api/meetings/${encodeURIComponent(deletingId)}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to delete file');
        }

        onDeleteMeeting(deletingId);
        if (selectedMeetingId === deletingId) {
          onSelectMeeting('');
        }
      } else if (deleteMode === 'bulk') {
        // Bulk delete
        const idsToDelete = Array.from(selectedFiles);

        await Promise.all(
          idsToDelete.map(async (meetingId) => {
            const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}`, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || `Failed to delete file ${meetingId}`);
            }
          })
        );

        // Notify parent component for each deleted file
        idsToDelete.forEach((id) => {
          onDeleteMeeting(id);
          if (selectedMeetingId === id) {
            onSelectMeeting('');
          }
        });

        setSelectedFiles(new Set());
      }

      setShowDeleteModal(false);
      setDeletingId(null);
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleSelect = (meetingId: string) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(meetingId)) {
        newSet.delete(meetingId);
      } else {
        newSet.add(meetingId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === filteredMeetings.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredMeetings.map((m) => m.id)));
    }
  };

  // Filter meetings by project
  const projectMeetings = useMemo(() => {
    return meetings.filter((m) => (m.project_group || 'General') === projectName);
  }, [meetings, projectName]);

  // Search and sort
  const filteredMeetings = useMemo(() => {
    let results = projectMeetings;

    // Apply search filter
    if (searchTerm) {
      results = results.filter((m) =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sort
    results.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'latest' ? dateB - dateA : dateA - dateB;
    });

    return results;
  }, [projectMeetings, searchTerm, sortOrder]);

  return (
    <>
      <div className="space-y-4">
        <div className="flex gap-3 items-center">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700">
                {sortOrder === 'latest' ? 'Latest' : 'Earliest'}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                <button
                  onClick={() => {
                    setSortOrder('latest');
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors ${
                    sortOrder === 'latest' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'
                  }`}
                >
                  Latest
                </button>
                <button
                  onClick={() => {
                    setSortOrder('earliest');
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors ${
                    sortOrder === 'earliest' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'
                  }`}
                >
                  Earliest
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bulk Delete Bar */}
        {selectedFiles.size > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-medium text-indigo-900">
                {selectedFiles.size} {selectedFiles.size === 1 ? 'file' : 'files'} selected
              </span>
            </div>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected
            </button>
          </div>
        )}

        {/* Files List */}
        <div className="space-y-2">
          {filteredMeetings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'No files match your search' : 'No files in this project'}
            </div>
          ) : (
            <>
              {/* Select All Header */}
              {filteredMeetings.length > 1 && (
                <div className="flex items-center gap-2 px-4 py-2 text-sm">
                  <button
                    onClick={handleSelectAll}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedFiles.size === filteredMeetings.length
                        ? 'bg-indigo-600 border-indigo-600'
                        : selectedFiles.size > 0
                        ? 'bg-indigo-100 border-indigo-600'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {(selectedFiles.size > 0) && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <span className="text-gray-600 font-medium">Select All</span>
                </div>
              )}

              {/* File Items */}
              {filteredMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg border transition-all group ${
                    selectedFiles.has(meeting.id)
                      ? 'bg-indigo-50 border-indigo-300'
                      : selectedMeetingId === meeting.id
                      ? 'bg-indigo-50 border-indigo-300 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleSelect(meeting.id);
                    }}
                    className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                      selectedFiles.has(meeting.id)
                        ? 'bg-indigo-600 border-indigo-600'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {selectedFiles.has(meeting.id) && <Check className="w-3 h-3 text-white" />}
                  </button>

                  {/* File Info */}
                  <button
                    onClick={() => onSelectMeeting(meeting.id)}
                    className="flex-1 text-left"
                  >
                    <h4 className="font-medium text-gray-900">{meeting.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(meeting.created_at).toLocaleDateString()} • {meeting.word_count} words
                    </p>
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDeleteMeeting(e, meeting.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"
                    title="Delete file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        title={deleteMode === 'bulk' ? 'Delete Files' : 'Delete File'}
        message={
          deleteMode === 'bulk'
            ? `Are you sure you want to delete ${selectedFiles.size} file${selectedFiles.size !== 1 ? 's' : ''}? This cannot be undone.`
            : 'Are you sure you want to delete this file? This cannot be undone.'
        }
        itemCount={deleteMode === 'bulk' ? selectedFiles.size : 1}
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setDeletingId(null);
        }}
      />
    </>
  );
}
