// app/api/folders/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getAuthenticatedUser, getEffectiveUserId } from '@/lib/api-auth';

export async function GET() {
  try {
    // Get authenticated user
    const user = await getAuthenticatedUser();
    const userId = user ? await getEffectiveUserId(user) : null;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { data: folders, error } = await supabaseServer
      .from('meetings')
      .select('project_group')
      .eq('user_id', userId)
      .order('project_group', { ascending: true });

    if (error) throw error;

    // Normalize null/empty groups to General and deduplicate.
    const uniqueFolders = Array.from(
      new Set(
        (folders || [])
          .map((f) => (f.project_group || 'General').trim())
          .filter(Boolean)
      )
    );

    return NextResponse.json({ folders: uniqueFolders });
  } catch (error: any) {
    console.error('Failed to fetch folders:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch folders' },
      { status: 500 }
    );
  }
}
