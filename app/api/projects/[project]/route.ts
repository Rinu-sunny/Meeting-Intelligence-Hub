// app/api/projects/[project]/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getAuthenticatedUser, getEffectiveUserId } from '@/lib/api-auth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ project: string }> }
) {
  try {
    const { project } = await params;
    const projectName = decodeURIComponent(project);
    
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
    
    console.log('🗑️ [DELETE] Deleting project:', projectName, 'for user:', userId);

    // First, get ALL meetings for this user to debug
    const { data: allUserMeetings } = await supabaseServer
      .from('meetings')
      .select('id, project_group')
      .eq('user_id', userId);
    
    console.log('🗑️ [DELETE] Total meetings for user:', allUserMeetings?.length || 0);
    if (allUserMeetings && allUserMeetings.length > 0) {
      console.log('🗑️ [DELETE] Sample meetings:', allUserMeetings.slice(0, 3));
      const groups = [...new Set(allUserMeetings.map(m => m.project_group || 'NULL'))];
      console.log('🗑️ [DELETE] Available project_groups:', groups);
    }

    // Build query based on project name
    let deleteQuery = supabaseServer
      .from('meetings')
      .select('id')
      .eq('user_id', userId);

    if (projectName === 'General') {
      deleteQuery = deleteQuery.or('project_group.is.null,project_group.eq.General');
    } else {
      deleteQuery = deleteQuery.eq('project_group', projectName);
    }

    const { data: meetings, error: queryError } = await deleteQuery;
    
    if (queryError) {
      console.error('🗑️ [DELETE] Query error:', queryError);
      throw queryError;
    }
    
    const meetingIds = (meetings || []).map((m: any) => m.id);
    
    console.log('🗑️ [DELETE] Found', meetingIds.length, 'meetings matching', projectName);

    // Delete sentiment data for all meetings
    if (meetingIds.length > 0) {
      await supabaseServer.from('sentiment_data').delete().in('meeting_id', meetingIds);
      await supabaseServer.from('insights').delete().in('meeting_id', meetingIds);
      await supabaseServer.from('transcripts').delete().in('meeting_id', meetingIds);
      await supabaseServer.from('meetings').delete().in('id', meetingIds);
      console.log('✅ [DELETE] Successfully deleted', meetingIds.length, 'meetings');
    } else {
      console.log('⚠️ [DELETE] No meetings found for project:', projectName);
    }

    return NextResponse.json({ success: true, deletedCount: meetingIds.length });
  } catch (error: any) {
    console.error('❌ [DELETE /api/projects/:project] Failed to delete project:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete project' },
      { status: 500 }
    );
  }
}
