import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getAuthenticatedUser, getEffectiveUserId } from '@/lib/api-auth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const meetingId = decodeURIComponent(id);

    const user = await getAuthenticatedUser();
    const authUserId = user?.id;

    if (!authUserId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = await getEffectiveUserId(user);

    const { data: meeting, error: meetingError } = await supabaseServer
      .from('meetings')
      .select('id')
      .eq('id', meetingId)
      .eq('user_id', userId)
      .maybeSingle();

    if (meetingError) throw meetingError;

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    await supabaseServer.from('sentiment_data').delete().eq('meeting_id', meetingId);
    await supabaseServer.from('insights').delete().eq('meeting_id', meetingId);
    await supabaseServer.from('transcripts').delete().eq('meeting_id', meetingId);

    const { error: deleteError } = await supabaseServer
      .from('meetings')
      .delete()
      .eq('id', meetingId)
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true, deletedId: meetingId });
  } catch (error: any) {
    console.error('❌ [DELETE /api/meetings/:id] Failed to delete meeting:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete meeting' },
      { status: 500 }
    );
  }
}