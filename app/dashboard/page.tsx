'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Meeting } from '@/lib/types';
import ProjectFolders from '../../components/dashboard/ProjectFolders';
import ProjectView from '../../components/dashboard/ProjectView';
import DashboardStats from '../../components/dashboard/DashboardStats';
import { ChevronLeft } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.push('/auth/login');
          return;
        }
        setUser(authUser);
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/auth/login');
      } finally {
        setAuthChecking(false);
      }
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!authChecking && user) {
      fetchMeetings();
    }
  }, [authChecking, user]);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      if (!user?.id) {
        console.warn('No user ID available');
        setMeetings([]);
        return;
      }
      
      // Fetch through API endpoint (handles legacy user resolution and auth)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('No authenticated session');
        setMeetings([]);
        return;
      }

      const response = await fetch('/api/meetings', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch meetings:', response.statusText);
        setMeetings([]);
        return;
      }

      const { meetings: data } = await response.json();
      setMeetings(data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
  };

  const handleMeetingDeleted = (meetingId: string) => {
    // Update local state to remove deleted meeting
    setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
  };

  const handleProjectDeleted = async (projectName: string) => {
    // Remove all meetings from this project locally
    setMeetings((prev) => prev.filter((m) => (m.project_group || 'General') !== projectName));
    // Close project view if it was selected
    if (selectedProject === projectName) {
      setSelectedProject(null);
    }
  };

  // Show loading state while checking auth
  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show nothing if not authenticated (redirect will happen)
  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen p-6 sm:p-10 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header with user info and logout button */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">{user?.email}</p>
          </div>
        </div>

        {/* Back button for project view */}
        {selectedProject && (
          <button
            onClick={handleBackToProjects}
            className="flex items-center gap-2 mb-6 text-indigo-600 hover:text-indigo-700 font-medium"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Projects
          </button>
        )}

        {/* Stats Bar - Only show on projects view */}
        {!selectedProject && <DashboardStats />}

        {selectedProject ? (
          <ProjectView 
            projectName={selectedProject} 
            meetings={meetings}
            onMeetingDeleted={handleMeetingDeleted}
          />
        ) : (
          <ProjectFolders 
            onSelectProject={setSelectedProject}
            onDeleteProject={handleProjectDeleted}
          />
        )}
      </div>
    </main>
  );
}
