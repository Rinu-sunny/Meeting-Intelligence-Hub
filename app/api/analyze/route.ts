// app/api/analyze/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { getAIAnalysis } from '@/lib/ai/engine';

export async function POST(req: Request) {
  try {
    const { transcript, meetingName } = await req.json();

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json({ error: 'Transcript is required.' }, { status: 400 });
    }

    const insights = await getAIAnalysis(transcript);

    // 1. Calculate the word count (Supabase expects this)
    const words = transcript.split(' ').length;

    // 2. Insert into Supabase using YOUR specific columns
    const { data, error } = await supabase
      .from('meetings')
      .insert([
        { 
          name: meetingName || "Untitled Meeting", 
          word_count: words,
          // If you haven't added 'decisions' columns yet, stick to these basics first
        }
      ])
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data:{ 
        ...data[0],
        intelligence: insights }});

  } catch (error: any) {
    console.error("❌ ERROR:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}