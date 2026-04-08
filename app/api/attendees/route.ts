// app/api/attendees/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/api-auth';

export async function GET(req: Request) {
  try {
    // Get authenticated user
    const user = await getAuthenticatedUser();
    const userId = user?.id;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const projectGroup = searchParams.get('folder') || null;

    // Get meetings for the folder/all - filtered by user
    let meetingsQuery = supabaseServer
      .from('meetings')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (projectGroup) {
      meetingsQuery = meetingsQuery.eq('project_group', projectGroup);
    }

    const { data: meetings, error: meetingsError } = await meetingsQuery.limit(50);

    if (meetingsError) throw meetingsError;

    const meetingIds = (meetings || []).map((m) => m.id);

    if (meetingIds.length === 0) {
      return NextResponse.json({ attendees: [], count: 0 });
    }

    // Get all transcripts for these meetings - filtered by user
    const { data: transcripts, error: transcriptsError } = await supabaseServer
      .from('transcripts')
      .select('content, meeting_id')
      .eq('user_id', userId)
      .in('meeting_id', meetingIds);

    if (transcriptsError) throw transcriptsError;

    // Extract names from transcripts using regex patterns
    // Look for patterns like "Name:", "Name said", "Name mentioned", etc.
    const namePatterns = [
      /(?:^|\W)([A-Z][a-z]+)\s*(?:said|said:|mentioned|says|commented|added|replied|answered|stated):/gm,
      /^([A-Z][a-z]+):/gm,
      /(?:from|by|with)\s+([A-Z][a-z]+)/g,
    ];

    const attendees = new Set<string>();

    (transcripts || []).forEach((transcript) => {
      namePatterns.forEach((pattern) => {
        let match;
        while ((match = pattern.exec(transcript.content)) !== null) {
          const name = match[1];
          // Filter out common false positives
          if (name && name.length > 1 && !['The', 'Team', 'Here', 'Now'].includes(name)) {
            attendees.add(name);
          }
        }
      });
    });

    const attendeeList = Array.from(attendees).sort();

    return NextResponse.json({ 
      attendees: attendeeList, 
      count: attendeeList.length,
      folder: projectGroup || 'All Folders'
    });
  } catch (error: any) {
    console.error('Failed to fetch attendees:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch attendees' },
      { status: 500 }
    );
  }
}
