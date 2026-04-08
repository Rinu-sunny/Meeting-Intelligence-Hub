// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getAuthenticatedUser, getEffectiveUserId } from '@/lib/api-auth';

type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type SourceRef = {
  meetingId: string;
  meetingName: string;
  transcriptId?: string;
  snippet: string;
};

type TranscriptRow = {
  id: string;
  meeting_id: string;
  content: string;
  file_name: string;
};

type InsightRow = {
  meeting_id: string;
  type: string;
  content: string;
  assignee?: string | null;
  due_date?: string | null;
};

const tokenize = (text: string): string[] =>
  Array.from(new Set((text.toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter((word) => word.length > 2)));

const extractSpeakers = (transcripts: TranscriptRow[]): Set<string> => {
  const speakers = new Set<string>();
  
  // Common transcript metadata to filter out
  const metadataFilter = /^(Project|Transcript|Date|Time|Participants|Attendees|Decisions|Actions|Next|Steps|Agenda|Minutes|Summary|Transcript|Meeting|Session|Conference|Discussion|Note|Notes|File|Duration|Location|Purpose|Outcome|Follow|By|DECIDED|ACTION)$/i;

  transcripts.forEach((transcript) => {
    // Pattern 1: Look for actual dialogue - lines with speaker name followed by actual content
    // "Name: some detailed message here" (not just a header)
    const dialoguePattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*:\s+.{10,}/gm;
    let match;
    while ((match = dialoguePattern.exec(transcript.content)) !== null) {
      const name = match[1].trim();
      if (!metadataFilter.test(name) && name.length > 2 && name.length < 30) {
        speakers.add(name);
      }
    }
    
    // Pattern 2: [HH:MM] Name: format (common in transcripts with timestamps)
    const timestampPattern = /\[\d{1,2}:\d{2}(?::\d{2})?\]\s+([A-Z][a-z]+(?:\s+[A-Z]\w+)*)\s*:/gm;
    while ((match = timestampPattern.exec(transcript.content)) !== null) {
      const name = match[1].trim();
      if (!metadataFilter.test(name) && name.length > 2 && name.length < 30) {
        speakers.add(name);
      }
    }

    // Pattern 3: "Speaker Name said/mentioned/stated:"
    const verbPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:said|mentioned|stated|asked|explained|noted|replied)\s*[:]/gm;
    while ((match = verbPattern.exec(transcript.content)) !== null) {
      const name = match[1].trim();
      if (!metadataFilter.test(name) && name.length > 2 && name.length < 30) {
        speakers.add(name);
      }
    }
  });
  
  return speakers;
};

const snippetScore = (snippet: string, queryTokens: string[]) => {
  const lower = snippet.toLowerCase();
  return queryTokens.reduce((score, token) => score + (lower.includes(token) ? 1 : 0), 0);
};

const buildEvidenceFallback = (
  message: string,
  meetings: Array<{ id: string; name: string }> = [],
  insights: InsightRow[] = [],
  sources: SourceRef[] = []
) => {
  const lower = message.toLowerCase();
  const decisions = insights.filter((row) => /decision|decided/i.test(row.type)).map((row) => row.content).filter(Boolean);
  const actions = insights.filter((row) => /action|task|owner|assignee|next/i.test(row.type)).map((row) => row.content).filter(Boolean);

  const lines: string[] = [];
  lines.push(`I analyzed ${meetings.length} file(s) from the selected scope.`);

  if (/decision|decide|conclusion|outcome/.test(lower)) {
    if (decisions.length > 0) {
      lines.push('');
      lines.push('## Decisions found');
      decisions.slice(0, 12).forEach((d) => lines.push(`* ${d}`));
    } else {
      lines.push('No explicit decisions were detected in the indexed evidence.');
    }
  } else if (/action|task|owner|assignee|next step/.test(lower)) {
    if (actions.length > 0) {
      lines.push('');
      lines.push('## Action items found');
      actions.slice(0, 12).forEach((a) => lines.push(`* ${a}`));
    } else {
      lines.push('No explicit action items were detected in the indexed evidence.');
    }
  } else {
    if (decisions.length > 0) {
      lines.push('');
      lines.push('## Key decisions');
      decisions.slice(0, 8).forEach((d) => lines.push(`* ${d}`));
    }
    if (actions.length > 0) {
      lines.push('');
      lines.push('## Key action items');
      actions.slice(0, 8).forEach((a) => lines.push(`* ${a}`));
    }
    if (decisions.length === 0 && actions.length === 0) {
      lines.push('I could not extract structured insights for this query, but transcript evidence is attached in sources.');
    }
  }

  if (sources.length > 0) {
    lines.push('');
    lines.push('Sources are included below for verification.');
  }

  return lines.join('\n');
};

const toSnippetCandidates = (
  transcripts: TranscriptRow[],
  meetingNameMap: Map<string, string>
) => {
  const candidates: Array<{
    meetingId: string;
    meetingName: string;
    transcriptId: string;
    text: string;
  }> = [];

  transcripts.forEach((row) => {
    // Improvement #4: Better chunking with overlap for context preservation
    const sentences = row.content
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    // Primary path: sentence-aware chunking.
    if (sentences.length > 0) {
      for (let i = 0; i < sentences.length; i += 2) {
        // Stride of 2 with overlap
        const chunk = sentences
          .slice(i, Math.min(i + 4, sentences.length))
          .join(' ')
          .trim();

        if (chunk.length > 20) {
          const truncated = chunk.length > 420 ? `${chunk.slice(0, 420)}...` : chunk;
          candidates.push({
            meetingId: row.meeting_id,
            meetingName: meetingNameMap.get(row.meeting_id) || 'Untitled',
            transcriptId: row.id,
            text: truncated,
          });
        }
      }
    }

    // Fallback path: if sentence parsing produced no usable chunks,
    // still create chunk(s) from raw content so this file is never excluded.
    if (!candidates.some((c) => c.transcriptId === row.id) && row.content?.trim()) {
      const normalized = row.content.replace(/\s+/g, ' ').trim();
      if (normalized.length > 20) {
        const firstChunk = normalized.slice(0, 420);
        candidates.push({
          meetingId: row.meeting_id,
          meetingName: meetingNameMap.get(row.meeting_id) || 'Untitled',
          transcriptId: row.id,
          text: firstChunk,
        });

        if (normalized.length > 520) {
          const secondChunk = normalized.slice(200, 620);
          candidates.push({
            meetingId: row.meeting_id,
            meetingName: meetingNameMap.get(row.meeting_id) || 'Untitled',
            transcriptId: row.id,
            text: secondChunk,
          });
        }
      }
    }
  });

  return candidates;
};

export async function POST(req: Request) {
  const apiStartTime = Date.now(); // Improvement #5: Track total API time
  
  try {
    const queryStartTime = Date.now();
    const strategy = process.env.NEXT_PUBLIC_AI_STRATEGY || 'local';
    const { message, conversationHistory, projectGroup } = await req.json();

    console.log('[Chat API] Received query with projectGroup:', projectGroup);

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    // Get authenticated user
    const user = await getAuthenticatedUser();
    const userId = user ? await getEffectiveUserId(user) : null;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Check if query mentions "last week", "this week", specific time periods
    const isTimeFiltered = /last week|this week|past week|previous week|7 days?|7d/i.test(message);
    
    // Calculate date for last week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    let meetingsQuery = supabaseServer
      .from('meetings')
      .select('id, name, word_count, created_at, project_group')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // If user selected a specific folder, filter to that project group
    if (projectGroup && projectGroup.trim()) {
      console.log(`[Chat API] Filtering by projectGroup: "${projectGroup}"`);
      meetingsQuery = meetingsQuery.eq('project_group', projectGroup.trim());
    } else {
      console.log('[Chat API] No folder filter applied - returning all meetings');
    }

    // If user is asking about "last week", filter to that period
    if (isTimeFiltered) {
      meetingsQuery = meetingsQuery.gte('created_at', oneWeekAgo.toISOString());
    }

    const { data: meetings, error: meetingsError } = await meetingsQuery.limit(200);

    if (meetingsError) {
      console.error('[Chat API] Query error:', meetingsError);
      throw meetingsError;
    }

    console.log(`[Chat API] Found ${meetings?.length || 0} meetings${projectGroup ? ` for folder "${projectGroup}"` : ' (all folders)'}`);
    
    // If folder was specified but no results, show available folders
    if (projectGroup && meetings?.length === 0) {
      const { data: allFolders } = await supabaseServer
        .from('meetings')
        .select('project_group')
        .eq('user_id', userId)
        .not('project_group', 'is', null)
        .limit(100);
      const uniqueFolders = Array.from(new Set((allFolders || []).map((f) => f.project_group))).filter(Boolean);
      console.warn(`[Chat API] WARNING: No meetings found for folder "${projectGroup}". Available folders:`, uniqueFolders);
    }

    const meetingIds = (meetings || []).map((meeting) => meeting.id);
    const meetingNameMap = new Map<string, string>((meetings || []).map((meeting) => [meeting.id, meeting.name || 'Untitled']));

    const [{ data: transcripts, error: transcriptsError }, { data: insights, error: insightsError }] = await Promise.all([
      meetingIds.length
        ? supabaseServer
            .from('transcripts')
            .select('id, meeting_id, content, file_name')
            .in('meeting_id', meetingIds)
            .limit(1200)
        : Promise.resolve({ data: [], error: null as any }),
      meetingIds.length
        ? supabaseServer
            .from('insights')
            .select('meeting_id, type, content')  // Removed assignee, due_date for speed
            .in('meeting_id', meetingIds)
            .limit(400)
        : Promise.resolve({ data: [], error: null as any }),
    ]);

    if (transcriptsError) throw transcriptsError;
    if (insightsError) throw insightsError;

    const queryTime = Date.now() - queryStartTime;
    console.log(`📊 Database query time: ${queryTime}ms`);

    const queryTokens = tokenize(message);
    const candidates = toSnippetCandidates((transcripts || []) as TranscriptRow[], meetingNameMap);
    const ranked = candidates
      .map((candidate) => ({
        ...candidate,
        score: snippetScore(candidate.text, queryTokens),
      }))
      .sort((a, b) => b.score - a.score);

    // Broad queries should include more cross-file evidence.
    const isBroadQuery = /\ball\b|entire|everything|all files|all meetings|whole folder|complete/i.test(message);
    const maxSources = isBroadQuery ? 20 : 8;

    // Diversify evidence: first pass ensures at least one snippet per meeting (up to maxSources),
    // second pass fills remaining slots with highest-scoring leftovers.
    const groupedByMeeting = new Map<string, typeof ranked>();
    ranked.forEach((entry) => {
      const list = groupedByMeeting.get(entry.meetingId) || [];
      list.push(entry);
      groupedByMeeting.set(entry.meetingId, list);
    });

    const selectedKeys = new Set<string>();
    const contextRanked: typeof ranked = [];

    for (const meeting of meetings || []) {
      if (contextRanked.length >= maxSources) break;
      const list = groupedByMeeting.get(meeting.id);
      if (!list || list.length === 0) continue;
      const candidate = list[0];
      const key = `${candidate.transcriptId}|${candidate.text}`;
      if (!selectedKeys.has(key)) {
        selectedKeys.add(key);
        contextRanked.push(candidate);
      }
    }

    for (const candidate of ranked) {
      if (contextRanked.length >= maxSources) break;
      const key = `${candidate.transcriptId}|${candidate.text}`;
      if (selectedKeys.has(key)) continue;

      const meetingCount = contextRanked.filter((entry) => entry.meetingId === candidate.meetingId).length;
      if (meetingCount >= 3) continue;

      selectedKeys.add(key);
      contextRanked.push(candidate);
    }

    const sources: SourceRef[] = contextRanked.map((entry) => ({
      meetingId: entry.meetingId,
      meetingName: entry.meetingName,
      transcriptId: entry.transcriptId,
      snippet: entry.text,
    }));

    console.log('[Chat API] Sources being returned:', sources.map(s => `"${s.meetingName}"`).join(', '));

    const insightsByMeeting = new Map<string, InsightRow[]>();
    ((insights || []) as InsightRow[]).forEach((row) => {
      const current = insightsByMeeting.get(row.meeting_id) || [];
      current.push(row);
      insightsByMeeting.set(row.meeting_id, current);
    });

    const context = contextRanked
      .slice(0, maxSources)
      .map((entry, index) => {
        const meetingInsights = insightsByMeeting.get(entry.meetingId) || [];
        
        // Extract different types of insights with better matching
        const decisions = meetingInsights
          .filter((row) => /decision|decided|will|action/.test(row.type.toLowerCase()))
          .slice(0, 3)
          .map((row) => row.content)
          .filter(Boolean);

        const nextSteps = meetingInsights
          .filter((row) => /next|step|todo|followup/i.test(row.type.toLowerCase()))
          .slice(0, 3)
          .map((row) => row.content)
          .filter(Boolean);

        const actionItems = meetingInsights
          .filter((row) => /action|task|owner|assignee/i.test(row.type.toLowerCase()))
          .slice(0, 4)
          .map((row) => row.content)
          .filter(Boolean);

        const risks = meetingInsights
          .filter((row) => /risk|issue|blocker|concern/i.test(row.type.toLowerCase()))
          .slice(0, 3)
          .map((row) => row.content)
          .filter(Boolean);

        let insightText = `[${index + 1}] ${entry.meetingName}`;
        if (decisions.length > 0) {
          insightText += `\n✓ Decisions: ${decisions.join(' | ')}`;
        }
        if (actionItems.length > 0) {
          insightText += `\n📝 Action Items: ${actionItems.join(' | ')}`;
        }
        if (nextSteps.length > 0) {
          insightText += `\n→ Next: ${nextSteps.join(' | ')}`;
        }
        if (risks.length > 0) {
          insightText += `\n⚠ Risks/Issues: ${risks.join(' | ')}`;
        }
        if (decisions.length === 0 && nextSteps.length === 0) {
          insightText += '\nTranscript snippet for context provided above';
        }

        return insightText;
      })
      .join('\n\n');

    console.log(`[Chat API] Context being sent to LLM (first 500 chars):\n${context.substring(0, 500)}...`);

    // Extract speakers from all transcripts
    const speakers = extractSpeakers((transcripts || []) as TranscriptRow[]);
    console.log('[Chat API] 🎤 Extracted speakers:', Array.from(speakers));
    console.log('[Chat API] 📋 Total transcripts analyzed:', transcripts?.length || 0);

    // Build system prompt with speaker context
    const systemPromptWithSpeakers = `You are a careful meeting intelligence analyst.

  Use ONLY the evidence provided below.
  Extract as much relevant information as possible, but do not invent facts.
  If information is missing or ambiguous, explicitly say so.
  For requests like "all decisions" or "everything", provide a comprehensive list from the evidence.

  Rules:
  - Ground every major claim in evidence and include citations [1], [2], etc.
  - Prefer completeness over brevity when the user asks for full extraction.
  - Separate decisions, action items, risks, and next steps clearly when present.
  - If asked about speakers or attendees, list all discovered names.

MEETING DATA:
${context}

SPEAKERS: ${Array.from(speakers).join(', ') || 'Not found'}

  Respond clearly in markdown bullets when listing multiple items. Always include citations [1], [2], etc.`;

    console.log('[Chat API] 🤖 System prompt preview:', systemPromptWithSpeakers.substring(0, 200) + '...');


    const conversationMessages: ConversationMessage[] = [
      ...(conversationHistory || []),
      { role: 'user', content: message },
    ];

    const llmStartTime = Date.now();
    console.log(`[Chat API] Calling ${strategy === 'local' ? 'Ollama' : 'Groq'} API...`);
    
    let assistantResponse = '';
    let aiStrategy = strategy;

    // Try Ollama first if configured as local strategy
    if (strategy === 'local') {
      try {
        console.log('[Chat API] Attempting Ollama (local)...');
        const ollamaResponse = await fetch(
          `${process.env.NEXT_PUBLIC_OLLAMA_URL}/api/chat`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'llama3.2',
              messages: [
                { role: 'system', content: systemPromptWithSpeakers },
                ...conversationMessages,
              ],
              stream: false,
              options: {
                temperature: 0.2,
              },
            }),
            signal: AbortSignal.timeout(30000), // 30 second timeout
          }
        );

        if (!ollamaResponse.ok) {
          throw new Error(`Ollama returned ${ollamaResponse.status}`);
        }

        const ollamaData = await ollamaResponse.json();
        assistantResponse = ollamaData.message?.content || '';
        
        if (assistantResponse) {
          console.log('[Chat API] ✓ Ollama succeeded');
          aiStrategy = 'ollama';
        } else {
          throw new Error('Empty response from Ollama');
        }
      } catch (ollamaError) {
        console.warn('[Chat API] ✗ Ollama failed, falling back to Groq:', (ollamaError as Error).message);
        aiStrategy = 'groq';
        // Continue to Groq below
      }
    }

    // If Ollama failed or wasn't used, try Groq
    if (!assistantResponse && process.env.GROQ_API_KEY) {
      try {
        console.log('[Chat API] Attempting Groq (cloud)...');
        const groqResponse = await fetch(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'llama-3.1-8b-instant',
              messages: [
                { role: 'system', content: systemPromptWithSpeakers },
                ...conversationMessages,
              ],
              temperature: 0.2,
              max_tokens: 2000,
            }),
          }
        );

        if (!groqResponse.ok) {
          const errorText = await groqResponse.text();
          throw new Error(`Groq returned ${groqResponse.status}: ${errorText}`);
        }

        const groqData = await groqResponse.json();
        assistantResponse = groqData.choices?.[0]?.message?.content || '';
        
        if (assistantResponse) {
          console.log('[Chat API] ✓ Groq succeeded');
        } else {
          throw new Error('Empty response from Groq');
        }
      } catch (groqError) {
        console.error('[Chat API] ✗ Groq failed:', (groqError as Error).message);
        assistantResponse = buildEvidenceFallback(
          message,
          (meetings || []).map((m) => ({ id: m.id, name: m.name || 'Untitled' })),
          (insights || []) as InsightRow[],
          sources
        );
      }
    } else if (!assistantResponse) {
      assistantResponse = buildEvidenceFallback(
        message,
        (meetings || []).map((m) => ({ id: m.id, name: m.name || 'Untitled' })),
        (insights || []) as InsightRow[],
        sources
      );
    }

    if (!assistantResponse || !assistantResponse.trim()) {
      assistantResponse = buildEvidenceFallback(
        message,
        (meetings || []).map((m) => ({ id: m.id, name: m.name || 'Untitled' })),
        (insights || []) as InsightRow[],
        sources
      );
    }

    const llmTime = Date.now() - llmStartTime;
    console.log(`⚙️  LLM generation time: ${llmTime}ms (${aiStrategy})`);

    const totalTime = Date.now() - apiStartTime;
    console.log(`✅ Total API time: ${totalTime}ms (Query: ${queryTime}ms, LLM: ${llmTime}ms)`);

    return NextResponse.json({
      response: assistantResponse,
      sources,
      timing: {
        total: totalTime,
        database: queryTime,
        llm: llmTime,
      },
      aiStrategy: aiStrategy,
    });
  } catch (error: any) {
    const totalTime = Date.now() - apiStartTime;
    console.error(`❌ Chat API Error (${totalTime}ms):`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to process chat message.' },
      { status: 500 }
    );
  }
}
