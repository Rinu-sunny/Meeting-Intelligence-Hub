// app/api/migrate-user-data/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/api-auth';

export async function POST() {
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

    console.log('🔄 [migrate-user-data] Starting migration for user:', userId, 'email:', user.email);

    // 0a. Check if there's a legacy user profile with the same email FIRST
    const { data: legacyUsers } = await supabaseServer
      .from('users')
      .select('id')
      .eq('email', user.email || '');

    let targetUserId = userId;

    // If we find a user (legacy or current), use it: 
    if (legacyUsers && legacyUsers.length > 0) {
      // Use the existing user (whether it's the auth user or a legacy user)
      targetUserId = legacyUsers[0].id;
      console.log('✅ [migrate-user-data] Found existing user:', targetUserId);
    } else {
      // No user found, try to create one with auth user ID
      console.log('👤 [migrate-user-data] Creating new profile for auth user:', userId);
      const { error: createError } = await supabaseServer
        .from('users')
        .insert([
          {
            id: userId,
            email: user.email || 'unknown@example.com',
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          },
        ]);

      if (createError) {
        console.warn('⚠️ [migrate-user-data] Could not create user profile:', createError.message);
        console.log('⚠️ [migrate-user-data] Skipping migration - unable to create or find user');
        return NextResponse.json({
          success: false,
          message: 'Could not create or find user profile',
        }, { status: 400 });
      } else {
        console.log('✅ [migrate-user-data] User profile created');
        targetUserId = userId;
      }
    }

    console.log('🔄 [migrate-user-data] Using user ID:', targetUserId, 'for data operations');

    // 1. Update all meetings with NULL user_id to this user
    const { data: nullMeetings, error: selectError } = await supabaseServer
      .from('meetings')
      .select('id')
      .is('user_id', null);

    if (selectError) throw selectError;

    const meetingIds = (nullMeetings || []).map((m: any) => m.id);
    console.log('🔄 [migrate-user-data] Found', meetingIds.length, 'meetings without user_id');

    if (meetingIds.length > 0) {
      const { error: updateMeetingsError } = await supabaseServer
        .from('meetings')
        .update({ user_id: userId })
        .in('id', meetingIds);

      if (updateMeetingsError) throw updateMeetingsError;
      console.log('✅ [migrate-user-data] Updated', meetingIds.length, 'meetings');
    }

    // 2. Update all transcripts with NULL user_id
    const { data: nullTranscripts, error: selectTransError } = await supabaseServer
      .from('transcripts')
      .select('id')
      .is('user_id', null);

    if (selectTransError) throw selectTransError;

    const transcriptIds = (nullTranscripts || []).map((t: any) => t.id);
    if (transcriptIds.length > 0) {
      const { error: updateTransError } = await supabaseServer
        .from('transcripts')
        .update({ user_id: userId })
        .in('id', transcriptIds);

      if (updateTransError) throw updateTransError;
      console.log('✅ [migrate-user-data] Updated', transcriptIds.length, 'transcripts');
    }

    // 3. Update all insights with NULL user_id
    const { data: nullInsights, error: selectInsError } = await supabaseServer
      .from('insights')
      .select('id')
      .is('user_id', null);

    if (selectInsError) throw selectInsError;

    const insightIds = (nullInsights || []).map((i: any) => i.id);
    if (insightIds.length > 0) {
      const { error: updateInsError } = await supabaseServer
        .from('insights')
        .update({ user_id: userId })
        .in('id', insightIds);

      if (updateInsError) throw updateInsError;
      console.log('✅ [migrate-user-data] Updated', insightIds.length, 'insights');
    }

    // 4. Update all sentiment data with NULL user_id (if column exists)
    // Note: sentiment_data table doesn't have user_id, so skip this
    // const { data: nullSentiment, error: selectSentError } = await supabaseServer
    //   .from('sentiment_data')
    //   .select('id')
    //   .is('user_id', null);

    // if (selectSentError) throw selectSentError;

    // const sentimentIds = (nullSentiment || []).map((s: any) => s.id);
    // if (sentimentIds.length > 0) {
    //   const { error: updateSentError } = await supabaseServer
    //     .from('sentiment_data')
    //     .update({ user_id: targetUserId })
    //     .in('id', sentimentIds);

    //   if (updateSentError) throw updateSentError;
    //   console.log('✅ [migrate-user-data] Updated', sentimentIds.length, 'sentiment records');
    // }

    // 5. Update all conversations with NULL user_id
    const { data: nullConvs, error: selectConvError } = await supabaseServer
      .from('conversations')
      .select('id')
      .is('user_id', null);

    if (selectConvError) throw selectConvError;

    const convIds = (nullConvs || []).map((c: any) => c.id);
    if (convIds.length > 0) {
      const { error: updateConvError } = await supabaseServer
        .from('conversations')
        .update({ user_id: userId })
        .in('id', convIds);

      if (updateConvError) throw updateConvError;
      console.log('✅ [migrate-user-data] Updated', convIds.length, 'conversations');
    }

    // 6. Update all chat messages with NULL user_id
    const { data: nullMessages, error: selectMsgError } = await supabaseServer
      .from('chat_messages')
      .select('id')
      .is('user_id', null);

    if (selectMsgError) throw selectMsgError;

    const msgIds = (nullMessages || []).map((m: any) => m.id);
    if (msgIds.length > 0) {
      const { error: updateMsgError } = await supabaseServer
        .from('chat_messages')
        .update({ user_id: userId })
        .in('id', msgIds);

      if (updateMsgError) throw updateMsgError;
      console.log('✅ [migrate-user-data] Updated', msgIds.length, 'chat messages');
    }

    console.log('✅ [migrate-user-data] Migration complete!');

    return NextResponse.json({
      success: true,
      migrated: {
        meetings: meetingIds.length,
        transcripts: transcriptIds.length,
        insights: insightIds.length,
        conversations: convIds.length,
        messages: msgIds.length,
      },
    });
  } catch (error: any) {
    console.error('❌ [migrate-user-data] Failed:', error);
    return NextResponse.json(
      { error: error.message || 'Migration failed' },
      { status: 500 }
    );
  }
}
