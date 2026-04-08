import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getAuthenticatedUser, getEffectiveUserId } from '@/lib/api-auth';

export async function GET() {
  try {
    const startTime = Date.now();

    // Get authenticated user
    const user = await getAuthenticatedUser();
    const authUserId = user?.id;
    
    if (!authUserId) {
      return NextResponse.json(
        {
          totalFiles: 0,
          totalProjects: 0,
          sentimentScore: 85,
          aiServerStatus: 'disconnected',
          aiServerLatency: 0,
          error: 'Not authenticated',
        },
        { status: 401 }
      );
    }

    // Get the effective user ID (handles legacy users)
    const userId = await getEffectiveUserId(user);
    console.log('📊 [/api/dashboard/stats] Auth user ID:', authUserId, 'Effective user ID:', userId);

    // Fetch total transcripts (files uploaded) - user's files only
    const { count: filesCount, error: transcriptsError } = await supabaseServer
      .from('transcripts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (transcriptsError) throw transcriptsError;
    const totalFiles = filesCount || 0;

    // Fetch total unique projects (folders) - user's folders only
    const { data: projectsData, error: projectsError } = await supabaseServer
      .from('meetings')
      .select('id, project_group')
      .eq('user_id', userId);

    if (projectsError) throw projectsError;

    // Count unique project groups (folders)
    const uniqueProjects = new Set(
      (projectsData || [])
        .map((m: any) => m.project_group || 'General')
        .filter(Boolean)
    );
    const totalProjects = uniqueProjects.size || 0;

    // Calculate team sentiment from sentiment_data tied to this user's meetings.
    const meetingIds = (projectsData || []).map((m: any) => m.id).filter(Boolean);
    let sentimentScore = 85;

    if (meetingIds.length > 0) {
      const { data: sentimentRows, error: sentimentError } = await supabaseServer
        .from('sentiment_data')
        .select('score, label, meeting_id')
        .in('meeting_id', meetingIds);

      if (sentimentError) throw sentimentError;

      if (sentimentRows && sentimentRows.length > 0) {
        const normalizedScores = sentimentRows
          .map((row: any) => {
            if (typeof row.score === 'number' && Number.isFinite(row.score)) {
              // score is expected in [-1, 1]
              return Math.max(-1, Math.min(1, row.score));
            }
            if (row.label === 'positive') return 1;
            if (row.label === 'negative') return -1;
            return 0;
          });

        const avg = normalizedScores.reduce((sum, value) => sum + value, 0) / normalizedScores.length;
        // Convert [-1, 1] => [0, 100]
        sentimentScore = Math.round(((avg + 1) / 2) * 100);
      }
    }

    // Check AI Server Status (Ollama)
    let aiServerStatus = 'disconnected';
    let aiServerLatency = 0;

    try {
      const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL || 'http://localhost:11434';
      const ollamaStartTime = Date.now();
      const response = await fetch(`${ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      aiServerLatency = Date.now() - ollamaStartTime;
      aiServerStatus = response.ok ? 'connected' : 'disconnected';
    } catch (err) {
      aiServerStatus = 'disconnected';
    }

    const queryTime = Date.now() - startTime;

    return NextResponse.json({
      totalFiles,
      totalProjects,
      sentimentScore,
      aiServerStatus,
      aiServerLatency,
      queryTime,
    });
  } catch (error: any) {
    console.error('[Dashboard Stats API] Error:', error);
    return NextResponse.json(
      {
        totalFiles: 0,
        totalProjects: 0,
        sentimentScore: 85,
        aiServerStatus: 'disconnected',
        aiServerLatency: 0,
        error: error.message,
      },
      { status: 200 } // Return 200 with fallback data to avoid breaking UI
    );
  }
}
