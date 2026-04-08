// app/api/conversations/[id]/messages/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getAuthenticatedUser, getEffectiveUserId } from '@/lib/api-auth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const { role, content, sources } = await req.json();

    // Get authenticated user
    const user = await getAuthenticatedUser();
    const userId = user ? await getEffectiveUserId(user) : null;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await supabaseServer
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found or access denied' },
        { status: 404 }
      );
    }

    const { data: message, error } = await supabaseServer
      .from('chat_messages')
      .insert([
        {
          conversation_id: conversationId,
          user_id: userId,
          role,
          content,
          sources: sources || [],
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Update conversation's updated_at timestamp
    await supabaseServer
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)
      .eq('user_id', userId);

    return NextResponse.json({ message });
  } catch (error: any) {
    console.error('Failed to save message:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save message' },
      { status: 500 }
    );
  }
}
