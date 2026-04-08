// app/api/projects/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getAuthenticatedUser, getEffectiveUserId } from '@/lib/api-auth';

export async function GET() {
  try {
    // Get authenticated user
    const user = await getAuthenticatedUser();
    const authUserId = user?.id;
    
    if (!authUserId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get the effective user ID (handles legacy users)
    const userId = await getEffectiveUserId(user);
    console.log('🔍 [/api/projects] Auth user ID:', authUserId, 'Effective user ID:', userId);

    // Get all meetings for the user with their project groups
    const { data: meetings, error } = await supabaseServer
      .from('meetings')
      .select('project_group, user_id')
      .eq('user_id', userId);

    console.log('🔍 [/api/projects] Query result:', { 
      count: meetings?.length || 0, 
      error: error?.message,
      allMeetings: meetings // Show ALL meetings, not just first 2
    });

    if (error) throw error;

    // Group by project and count files
    const projectMap = new Map<string, number>();
    (meetings || []).forEach((row: any) => {
      const project = row.project_group || 'General';
      projectMap.set(project, (projectMap.get(project) || 0) + 1);
    });

    // Convert to array and sort
    const projects = Array.from(projectMap)
      .map(([name, fileCount]) => ({ name, fileCount }))
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log('📊 [/api/projects] Final projects:', projects);
    
    return NextResponse.json({ projects });
  } catch (error: any) {
    console.error('❌ [/api/projects] Failed to fetch projects:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
