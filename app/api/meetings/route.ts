// app/api/meetings/route.ts
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
    console.log('📋 [/api/meetings] Auth user ID:', authUserId, 'Effective user ID:', userId);

    // Fetch all meetings for the user
    const { data: meetings, error } = await supabaseServer
      .from('meetings')
      .select('id, name, word_count, created_at, project_group')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log('📋 [/api/meetings] Found', meetings?.length || 0, 'meetings');

    return NextResponse.json({ 
      meetings: meetings || [],
      count: meetings?.length || 0 
    });
  } catch (error: any) {
    console.error('❌ [/api/meetings] Failed to fetch meetings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch meetings' },
      { status: 500 }
    );
  }
}
