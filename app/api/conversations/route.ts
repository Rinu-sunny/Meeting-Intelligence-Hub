// app/api/conversations/route.ts
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

    const { data: conversations, error } = await supabaseServer
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ conversations });
  } catch (error: any) {
    console.error('Failed to fetch conversations:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
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

    const { title } = await req.json();

    const { data: conversation, error } = await supabaseServer
      .from('conversations')
      .insert([{ 
        title: title || 'New Conversation',
        user_id: userId
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ conversation });
  } catch (error: any) {
    console.error('Failed to create conversation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
