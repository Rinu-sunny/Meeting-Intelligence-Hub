'use client';

import React, { useEffect, useState } from 'react';
import { FolderOpen, ChevronRight, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import DeleteConfirmationModal from './DeleteConfirmationModal';

type ProjectFolder = {
  name: string;
  fileCount: number;
};

interface ProjectFoldersProps {
  onSelectProject: (projectName: string) => void;
  onDeleteProject?: (projectName: string) => void;
}

export default function ProjectFolders({ onSelectProject, onDeleteProject }: ProjectFoldersProps) {
  const [projects, setProjects] = useState<ProjectFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingProject, setDeletingProject] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      
      // Get the current session with access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        console.warn('Failed to get session or no access token');
        setProjects([]);
        setLoading(false);
        return;
      }
      
      const response = await fetch('/api/projects', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          setProjects([]);
          setLoading(false);
          return;
        }
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectName: string) => {
    e.stopPropagation();
    setDeletingProject(projectName);
    setShowDeleteModal(true);
  };

  const confirmDeleteProject = async () => {
    if (!deletingProject) return;
    setIsDeleting(true);
    try {
      // Get the current session with access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error('No session available');
      }

      console.log('🗑️ [DELETE Button] Deleting project:', deletingProject);

      const response = await fetch(`/api/projects/${encodeURIComponent(deletingProject)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      console.log('🗑️ [DELETE Button] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('🗑️ [DELETE Button] Error response:', errorData);
        throw new Error(errorData.error || 'Failed to delete project');
      }

      const result = await response.json();
      console.log('🗑️ [DELETE Button] Success response:', result);

      // Remove from local state
      setProjects((prev) => prev.filter((p) => p.name !== deletingProject));

      // Call callback
      if (onDeleteProject) {
        onDeleteProject(deletingProject);
      }

      setShowDeleteModal(false);
      setDeletingProject(null);
      
      // Refresh projects list to verify deletion persisted
      setTimeout(fetchProjects, 500);
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert(`Failed to delete project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-2xl p-6 h-32" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
            <FolderOpen className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No projects yet</h3>
            <p className="text-gray-500 mb-6">Upload your first transcript to create a project</p>
            <a
              href="/upload"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Upload Transcript
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.name}
                onClick={() => onSelectProject(project.name)}
                className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-lg hover:border-indigo-300 cursor-pointer"
              >
                {/* Background gradient on hover */}
                <div className="absolute inset-0 bg-linear-to-br from-indigo-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                {/* Content */}
                <div className="relative space-y-4 p-6">
                  <div className="flex items-center justify-between">
                    <FolderOpen className="w-10 h-10 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(e, project.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 z-10"
                        type="button"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg text-gray-900 group-hover:text-indigo-900 transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-sm text-gray-500 group-hover:text-gray-700 transition-colors mt-1">
                      {project.fileCount} {project.fileCount === 1 ? 'file' : 'files'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        title="Delete Project"
        message={`Are you sure you want to delete "${deletingProject}" and all its files? This cannot be undone.`}
        itemCount={projects.find((p) => p.name === deletingProject)?.fileCount || 0}
        isLoading={isDeleting}
        onConfirm={confirmDeleteProject}
        onCancel={() => {
          setShowDeleteModal(false);
          setDeletingProject(null);
        }}
      />
    </>
  );
}
