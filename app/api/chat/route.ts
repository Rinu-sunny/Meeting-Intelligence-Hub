// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { getAIAnalysis } from '@/lib/ai/engine';

type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function POST(req: Request) {
  try {
    const { message, meetingId, conversationHistory } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    let context = '';

    if (meetingId) {
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (meetingError) throw meetingError;

      const { data: insights, error: insightsError } = await supabase
        .from('insights')
        .select('*')
        .eq('meeting_id', meetingId);

      if (insightsError) throw insightsError;

      const decisions = insights?.filter((i) => i.type === 'decision').map((i) => i.content) || [];
      const actionItems = insights?.filter((i) => i.type === 'action_item') || [];

      context = `
Meeting: ${meeting?.name || 'Untitled'}
Word Count: ${meeting?.word_count || 0}

Decisions:
${decisions.map((d) => `- ${d}`).join('\n')}

Action Items:
${actionItems.map((item) => `- ${item.content} (Assignee: ${item.assignee || 'Unassigned'}, Due: ${item.due_date || 'Not specified'})`).join('\n')}
      `;
    }

    const systemPrompt = `You are a helpful Meeting Intelligence Assistant. You help users understand meeting insights, decisions, and action items.
    
${context ? `Here is the context from the meeting:\n${context}` : 'No specific meeting context available.'}

Answer the user's question based on the meeting context if available. Be concise and helpful.`;

    const conversationMessages: ConversationMessage[] = [
      ...(conversationHistory || []),
      { role: 'user', content: message },
    ];

    const response = await fetch(
      process.env.AI_STRATEGY === 'local'
        ? `${process.env.NEXT_PUBLIC_OLLAMA_URL}/api/chat`
        : 'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.AI_STRATEGY !== 'local' && {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          }),
        },
        body: JSON.stringify(
          process.env.AI_STRATEGY === 'local'
            ? {
                model: 'llama3',
                messages: [
                  { role: 'system', content: systemPrompt },
                  ...conversationMessages,
                ],
                stream: false,
              }
            : {
                model: 'llama3-8b-8192',
                messages: [
                  { role: 'system', content: systemPrompt },
                  ...conversationMessages,
                ],
              }
        ),
      }
    );

    const aiData = await response.json();

    let assistantResponse = '';
    if (process.env.AI_STRATEGY === 'local') {
      assistantResponse = aiData.message?.content || 'No response generated.';
    } else {
      assistantResponse = aiData.choices?.[0]?.message?.content || 'No response generated.';
    }

    return NextResponse.json({ response: assistantResponse });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process chat message.' },
      { status: 500 }
    );
  }
}
