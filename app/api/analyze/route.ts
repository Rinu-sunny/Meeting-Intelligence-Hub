// app/api/analyze/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getAIAnalysis, MeetingIntelligence } from '@/lib/ai/engine';
import { generateMeetingSummary } from '@/lib/ai/summary';
import { getAuthenticatedUser, getEffectiveUserId } from '@/lib/api-auth';

type ActionItem = {
  who: string;
  what: string;
  due_date: string;
};

const DATE_REGEX = /(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/;

const detectMeetingDate = (transcript: string): string => {
  const match = transcript.match(DATE_REGEX);
  if (!match) return new Date().toISOString();

  const parsed = new Date(match[0]);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
};

const detectSpeakerCount = (transcript: string): number => {
  const speakers = new Set<string>();
  const speakerMatches = transcript.match(/^[A-Za-z][A-Za-z\s]{0,30}:/gm) || [];

  speakerMatches.forEach((entry) => {
    const name = entry.replace(':', '').trim();
    if (name) speakers.add(name);
  });

  return speakers.size;
};

type SentimentRow = {
  meeting_id: string;
  speaker_name: string;
  segment_timestamp: string;
  score: number;
  label: 'positive' | 'neutral' | 'negative';
  transcript_snippet: string;
};

const POSITIVE_WORDS = [
  'great', 'good', 'excellent', 'amazing', 'awesome', 'fantastic', 'wonderful', 'brilliant',
  'love', 'liked', 'happy', 'excited', 'hyped', 'proud', 'success', 'win',
  'improve', 'improved', 'better', 'best', 'perfect', 'accomplished', 'achieved',
  'aligned', 'agree', 'glad', 'pleased', 'thrilled', 'delighted', 'confident',
  'positive', 'right', 'correct', 'works', 'working', 'ready', 'complete', 'done',
  'appreciate', 'thankful', 'grateful', 'super', 'cool', 'nice',
  'helpful', 'useful', 'valuable', 'productive', 'efficient', 'smart', 'clever', 'talented',
  'beautiful', 'sleek', 'polished', 'smooth', 'killer', 'strong', 'easy', 'fast',
  'impressed', 'breakthrough', 'delivered', 'solved', 'fixed', 'resolved', 'clean',
  'seamless', 'intuitive', 'fantastic', 'awesome', 'stellar'
];

const NEGATIVE_WORDS = [
  'bad', 'terrible', 'awful', 'horrible', 'poor', 'wrong', 'failed', 'fail',
  'error', 'errors', 'bug', 'bugs', 'broken', 'break', 'issue', 'issues',
  'problem', 'problems', 'blocked', 'blocking', 'stuck', 'frustrated', 'frustration', 'anger',
  'angry', 'upset', 'scared', 'worried', 'concern', 'concerns', 'lose', 'losing',
  'risk', 'risks', 'danger', 'dangerous', 'conflict', 'fights', 'confused', 'confusing',
  'unclear', 'delay', 'delayed', 'late', 'slow', 'missing', 'incomplete',
  'crash', 'crashed', 'burning', 'struggle', 'struggling', 'difficult', 'hard',
  'impossible', 'failure', 'stress', 'stressed', 'buggy', 'jank', 'janky',
  'mess', 'messy', 'cursed', 'headache', 'nightmare', 'sucks', 'hate', 'hated',
  'annoyed', 'annoying', 'painful', 'pain', 'broken', 'nightmare', 'disaster',
  'catastrophe', 'disaster', 'shambles', 'terrible', 'critical', 'severe', 'chaos',
  'havoc', 'meltdown', 'despair', 'hopeless'
];

// Phrase-level sentiment detection for better context
const POSITIVE_PHRASES = [
  'really good', 'pretty good', 'so good', 'very good', 'looks good', 'all good', 'sounds good',
  'going well', 'working well', 'going great', 'great work', 'great job', 'nice work', 'well done',
  'love it', 'loving it', 'love this', 'really like', 'pretty awesome', 'so awesome',
  'super happy', 'very happy', 'really happy', 'excited about', 'hyped about', 'pumped about',
  'knocked it out', 'crushed it', 'nailed it', 'smashed it', 'absolutely brilliant',
  'thinking clearly', 'crystal clear', 'makes sense', 'totally agree', 'absolutely right',
  'quick fix', 'easy fix', 'no sweat', 'piece of cake', 'breeze through', 'smooth sailing'
];

const NEGATIVE_PHRASES = [
  'really bad', 'very bad', 'so bad', 'pretty bad', 'completely broken', 'totally broken',
  'losing my mind', 'losing it', 'going crazy', 'driving me crazy', 'out of my mind',
  'pulling my hair', 'pulling hair out', 'hitting my head', 'head hits wall', 'banging head',
  'can\'t believe', 'can\'t understand', 'makes no sense', 'doesn\'t make sense', 'nonsensical',
  'major issue', 'major problem', 'critical issue', 'critical problem', 'severe issue',
  'running in circles', 'going nowhere', 'dead end', 'brick wall', 'complete disaster',
  'total nightmare', 'absolute mess', 'falling apart', 'all broken', 'everything broken',
  'super frustrated', 'extremely frustrated', 'totally frustrated', 'really annoyed',
  'can\'t fix', 'won\'t fix', 'refuses to work', 'won\'t work', 'doesn\'t work',
  'wasted time', 'waste of time', 'pointless', 'useless', 'garbage', 'trash',
  'screaming inside', 'want to quit', 'want to scream', 'going to lose it'
];

type TranscriptSegment = {
  speaker: string;
  text: string;
  timestamp: string;
};

const SPEAKER_LINE_REGEX = /^(?:\[[\d:]+\]\s*)?([A-Za-z][A-Za-z .'-]{0,40}):\s*(.+)$/;
const TIME_ONLY_REGEX = /^[\[\(]?(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)[\]\)]?$/;
const VTT_RANGE_REGEX = /^(\d{2}:\d{2}:\d{2}[.,]\d{3})\s+-->\s+\d{2}:\d{2}:\d{2}[.,]\d{3}$/;
const BRACKET_TIME_REGEX = /^\[(\d{2}:\d{2})\]/;
// More flexible: matches "Sarah (S):" or "* Sarah (S):" or "Participants: * Sarah (S):"
const SPEAKER_MAPPING_REGEX = /([A-Za-z][A-Za-z\s.'-]{0,35})\s*\(([A-Z])\)\s*:/;

// Extract speaker name mappings from transcript header
const extractSpeakerMappings = (transcript: string): Map<string, string> => {
  const mappings = new Map<string, string>();
  const lines = transcript.split('\n').slice(0, 30); // Check first 30 lines for mappings
  
  lines.forEach((line) => {
    const match = line.match(SPEAKER_MAPPING_REGEX);
    if (match) {
      const fullName = match[1].trim();
      const abbreviation = match[2].trim();
      mappings.set(abbreviation, fullName);
      console.log(`🔤 Speaker mapping found: ${abbreviation} → ${fullName}`);
    }
  });
  
  return mappings;
};

const buildTranscriptSegments = (transcript: string): TranscriptSegment[] => {
  const speakerMappings = extractSpeakerMappings(transcript);
  const lines = transcript.split('\n').map((line) => line.trim()).filter(Boolean);
  const segments: TranscriptSegment[] = [];

  let currentSpeaker = 'Details';  // Changed from 'Unknown Speaker' to 'Details'
  let currentText: string[] = [];
  let currentTimestamp = 'segment-1';

  const isSpeakerListLine = (line: string): boolean => {
    // Skip lines that are speaker rosters like "* Sarah (S): Project Manager..."
    // or "Participants: Sarah, David, Elena..."
    if (line.startsWith('*') && line.includes('(') && line.includes(')')) return true;
    if (line.toLowerCase().startsWith('participants:')) return true;
    if (line.toLowerCase().startsWith('speakers:')) return true;
    if (line.toLowerCase().startsWith('attendees:')) return true;
    
    // Skip participant listing lines like "David (D): Lead Backend Engineer" (single letter abbreviation)
    if (line.match(/^[A-Za-z]+\s*\([A-Z]\)\s*:\s*[A-Z]/)) {
      return true;
    }
    
    return false;
  };

  const isMetadataLine = (line: string): boolean => {
    // Skip pure timestamp lines, empty lines that are just markers
    if (/^[\[\(]?\d{1,2}:\d{2}[\]\)]?$/.test(line)) return true;
    if (line.toLowerCase() === 'end' || line.toLowerCase() === 'begin') return true;
    return false;
  };

  const pushCurrent = () => {
    const text = currentText.join(' ').trim();
    if (!text || text.length < 5) return; // Skip very short segments
    segments.push({
      speaker: currentSpeaker || 'Details',
      text,
      timestamp: currentTimestamp,
    });
    currentText = [];
  };

  lines.forEach((line, index) => {
    // Skip speaker list metadata (lines like "* Sarah (S): Project Manager")
    if (isSpeakerListLine(line)) return;
    if (isMetadataLine(line)) return;

    // Check for VTT format (HH:MM:SS.mmm --> HH:MM:SS.mmm)
    if (VTT_RANGE_REGEX.test(line)) {
      currentTimestamp = line.split(' --> ')[0] || `segment-${index + 1}`;
      return;
    }

    // CHECK FOR DETAIL LINES FIRST (before speaker check)
    // This prevents "Meeting Transcript: ..." from being treated as a speaker line
    // which was causing line ordering issues
    const isDetailLine = (
      line.toLowerCase().includes('meeting') ||
      line.toLowerCase().includes('transcript') ||
      line.toLowerCase().includes('project') ||
      line.toLowerCase().includes('date:') ||
      line.toLowerCase().includes('time:') ||
      line.toLowerCase().includes('location:') ||
      line.toLowerCase().includes('october') ||
      line.toLowerCase().includes('january') ||
      line.toLowerCase().includes('february') ||
      line.toLowerCase().includes('march') ||
      line.toLowerCase().includes('april') ||
      line.toLowerCase().includes('may') ||
      line.toLowerCase().includes('june') ||
      line.toLowerCase().includes('july') ||
      line.toLowerCase().includes('august') ||
      line.toLowerCase().includes('september') ||
      line.toLowerCase().includes('november') ||
      line.toLowerCase().includes('december') ||
      /^\d{1,2}\/\d{1,2}\/\d{4}/.test(line) ||
      /^\d{4}-\d{2}-\d{2}/.test(line)
    );

    if (isDetailLine && currentText.length === 0) {
      // This is a detail/header line, capture as Details segment
      pushCurrent();
      currentSpeaker = 'Details';
      currentText = [line];
      return;
    }

    // Check for speaker: content pattern (with optional [HH:MM] prefix) - AFTER detail check
    // This ensures "Meeting Transcript: ..." is caught as detail, not as speaker line
    const speakerMatch = line.match(SPEAKER_LINE_REGEX);
    if (speakerMatch) {
      pushCurrent();
      let speakerName = speakerMatch[1].trim();
      
      // If speaker is single letter, try to expand using mappings
      if (speakerName.length === 1 && speakerMappings.has(speakerName)) {
        speakerName = speakerMappings.get(speakerName)!;
      }
      
      currentSpeaker = speakerName;
      currentText = [speakerMatch[2].trim()];
      // Extract timestamp if present in line
      const timeInLine = line.match(BRACKET_TIME_REGEX);
      if (timeInLine) {
        currentTimestamp = timeInLine[1];
      }
      return;
    }

    // Check for bracketed timestamp like [00:01] (only if alone on line)
    const bracketTimeMatch = line.match(BRACKET_TIME_REGEX);
    if (bracketTimeMatch && line === `[${bracketTimeMatch[1]}]`) {
      // Only treat as timestamp if it's the entire line
      currentTimestamp = bracketTimeMatch[1];
      return; // Don't treat timestamp as content
    }

    // Check for standalone time
    if (TIME_ONLY_REGEX.test(line)) {
      currentTimestamp = line.replace(/[\[\]]/g, '');
      return;
    }

    // Regular continuation line
    currentText.push(line);
    if (!currentTimestamp || currentTimestamp.startsWith('segment-')) {
      const timeInLine = line.match(BRACKET_TIME_REGEX);
      if (timeInLine) {
        currentTimestamp = timeInLine[1];
      }
    }
  });

  pushCurrent();

  if (segments.length === 0) {
    return [
      {
        speaker: 'Details',
        text: transcript.trim(),
        timestamp: 'segment-1',
      },
    ].filter((entry) => entry.text.length > 10);
  }

  return segments;
};

const scoreSegment = (text: string): number => {
  const lowerText = text.toLowerCase();
  
  // First check for phrase-level sentiment (more important than individual words)
  let positivePhrasesFound = 0;
  let negativePhrasesFound = 0;
  
  // Check for positive phrases
  POSITIVE_PHRASES.forEach((phrase) => {
    if (lowerText.includes(phrase)) {
      positivePhrasesFound += 3; // Phrases count triple
    }
  });
  
  // Check for negative phrases
  NEGATIVE_PHRASES.forEach((phrase) => {
    if (lowerText.includes(phrase)) {
      negativePhrasesFound += 3; // Phrases count triple
    }
  });
  
  // Count individual sentiment words
  const tokens = lowerText.match(/\b[a-z']+\b/g) || [];
  let positiveCount = positivePhrasesFound;
  let negativeCount = negativePhrasesFound;
  
  tokens.forEach((token) => {
    if (POSITIVE_WORDS.includes(token)) positiveCount++;
    if (NEGATIVE_WORDS.includes(token)) negativeCount++;
  });
  
  // AGGRESSIVE sentiment scoring:
  // The key insight: ANY negative sentiment should spark a RED flag
  if (negativeCount > 0 && positiveCount === 0) {
    // Pure negative - CLEARLY RED
    return -0.95;
  } else if (negativeCount > 0 && positiveCount > 0) {
    // Mixed sentiment - negative still takes priority (problems matter more)
    if (negativeCount > positiveCount) {
      return -0.85;
    } else if (positiveCount > negativeCount) {
      return 0.7;
    } else {
      return -0.2; // Tie edges negative
    }
  } else if (positiveCount > 0) {
    // Pure positive - CLEARLY GREEN
    return 0.95;
  }
  
  // No sentiment words = neutral
  return 0;
};

const toLabel = (score: number): 'positive' | 'neutral' | 'negative' => {
  if (score > 0.1) return 'positive';
  if (score < -0.1) return 'negative';
  return 'neutral';
};

const buildSentimentRows = (transcript: string, meetingId: string): SentimentRow[] => {
  // Removed segment limit to process complete transcripts
  // Previously: .slice(0, 400) was limiting analysis to first 400 segments
  const segments = buildTranscriptSegments(transcript);

  return segments.map((segment, index) => {
    const score = scoreSegment(segment.text);

    return {
      meeting_id: meetingId,
      speaker_name: segment.speaker || 'Details',
      segment_timestamp: segment.timestamp || `segment-${index + 1}`,
      score,
      label: toLabel(score),
      transcript_snippet: segment.text,
    };
  });
};

const insertSentimentWithFallback = async (rows: SentimentRow[]) => {
  if (!rows.length) return;

  try {
    // Batch inserts to avoid payload size limits (Supabase: ~6MB per request)
    const BATCH_SIZE = 200; // Process 200 rows at a time
    
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      console.log(`📦 Inserting sentiment batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)} (${batch.length} rows)`);
      
      const { error } = await supabaseServer.from('sentiment_data').insert(batch);
      
      if (!error) {
        console.log(`✓ Batch ${Math.floor(i / BATCH_SIZE) + 1} inserted successfully`);
        continue;
      }

      console.error(`✗ Error inserting batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
      console.log('Retrying batch with essential fields only...');
      
      // Fallback: only insert essential fields (label might not be in schema)
      const fallbackRows = batch.map(({ label, ...rest }) => rest);
      const { error: fallbackError } = await supabaseServer
        .from('sentiment_data')
        .insert(fallbackRows);
      
      if (fallbackError) {
        console.error(`✗ Fallback insertion for batch ${Math.floor(i / BATCH_SIZE) + 1} also failed:`, fallbackError);
        continue;
      }
      
      console.log(`✓ Batch ${Math.floor(i / BATCH_SIZE) + 1} inserted via fallback`);
    }
    
    console.log(`✓ All ${rows.length} sentiment rows processed`);
  } catch (err) {
    console.error('✗ Unexpected error in sentiment insertion:', err);
  }
};

const insertMeetingWithFallback = async (
  payload: Record<string, unknown>
): Promise<{ data: Record<string, any>; error: null } | { data: null; error: Error }> => {
  const keysToTry = ['summary', 'decisions', 'action_items', 'meeting_date', 'project_group', 'speaker_count'];
  const workingPayload = { ...payload };

  for (let attempt = 0; attempt <= keysToTry.length; attempt += 1) {
    const { data, error } = await supabaseServer
      .from('meetings')
      .insert([workingPayload])
      .select()
      .single();

    if (!error) return { data, error: null };

    const removableKey = keysToTry.find((key) => error.message.includes(key));
    if (!removableKey) return { data: null, error };
    console.log(`⚠ Column '${removableKey}' not in schema, retrying without it...`);
    delete workingPayload[removableKey];
  }

  return { data: null, error: new Error('Failed to insert meeting with schema fallback.') };
};

export async function POST(req: Request) {
  try {
    console.log('=== Analyze API Start ===');
    
    // Check environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL');
      throw new Error('Supabase URL not configured. Please set NEXT_PUBLIC_SUPABASE_URL in .env.local');
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('✗ Missing SUPABASE_SERVICE_ROLE_KEY');
      throw new Error('Supabase Service Role Key not configured. Please set SUPABASE_SERVICE_ROLE_KEY in .env.local');
    }
    console.log('✓ Environment variables verified');
    
    // Get authenticated user
    const user = await getAuthenticatedUser();
    const userId = user ? await getEffectiveUserId(user) : null;
    
    if (!userId) {
      console.warn('⚠ No authenticated user found - proceeding without user_id');
    } else {
      console.log('✓ User authenticated:', userId);
    }
    
    const { transcript, meetingName, fileName, projectGroup } = await req.json();
    console.log('✓ Request parsed');

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json({ error: 'Transcript is required.' }, { status: 400 });
    }

    console.log('✓ Transcript validated, length:', transcript.length);

    let insights: MeetingIntelligence = { decisions: [], action_items: [] };
    try {
      insights = await getAIAnalysis(transcript);
      
      const hasErrors = insights.error_context ? true : false;
      const logPrefix = hasErrors ? '⚠' : '✓';
      console.log(`${logPrefix} AI analysis complete:`, { 
        decisions: insights.decisions.length, 
        actions: insights.action_items.length,
        hadErrors: hasErrors,
        errorSource: insights.error_context?.source,
        errorType: insights.error_context?.error_type,
      });
      
      if (hasErrors) {
        console.warn(`[ANALYSIS] AI encountered ${insights.error_context?.error_type || 'unknown'} error from ${insights.error_context?.source || 'unknown'} source`);
        if (insights.error_context?.message) {
          console.warn(`[ANALYSIS] Error details:`, insights.error_context.message);
        }
      }
    } catch (aiError) {
      console.error('✗ AI analysis threw unexpected error (continuing):', aiError);
      // If getAIAnalysis throws, we still continue with empty insights
    }

    const words = transcript.split(/\s+/).filter(Boolean).length;
    const meetingDate = detectMeetingDate(transcript);
    const sentimentRows = buildSentimentRows(transcript, 'temp-meeting-id');
    const uniqueSpeakers = new Set(
      sentimentRows
        .map((row) => row.speaker_name)
        .filter((name) => name && name !== 'Unknown Speaker' && name !== 'Details')
    );
    const speakerCount = uniqueSpeakers.size || detectSpeakerCount(transcript) || 1;
    const segmentCount = sentimentRows.length;
    const averageSentiment =
      sentimentRows.length > 0
        ? Number(
            (
              sentimentRows.reduce((acc, row) => acc + Number(row.score || 0), 0) /
              sentimentRows.length
            ).toFixed(2)
          )
        : 0;

    console.log('✓ Sentiment analysis:', { segmentCount, averageSentiment, wordCount: words });

    // Generate meeting summary (2-3 lines)
    const summary = await generateMeetingSummary(
      {
        meeting_topic: insights.meeting_topic,
        meeting_purpose: insights.meeting_purpose,
        decisions: insights.decisions,
        nextSteps: insights.action_items?.map((item: any) => typeof item === 'string' ? item : item.what),
      },
      transcript
    );

    const { data: meeting, error: meetingError } = await insertMeetingWithFallback({
      name: meetingName || 'Untitled Meeting',
      word_count: words,
      meeting_date: meetingDate,
      project_group: projectGroup || 'General',
      speaker_count: speakerCount,
      summary,
      ...(userId && { user_id: userId }),
    });

    if (meetingError) {
      console.error('✗ Meeting insert failed:', meetingError);
      throw meetingError;
    }
    console.log('✓ Meeting created:', meeting.id);

    const { error: transcriptError } = await supabaseServer.from('transcripts').insert([
      {
        meeting_id: meeting.id,
        ...(userId && { user_id: userId }),
        file_name: fileName || `${meetingName || 'transcript'}.txt`,
        content: transcript,
        file_type: 'txt',
      },
    ]);

    if (transcriptError) {
      console.error('✗ Transcript insert failed:', transcriptError);
      throw transcriptError;
    }
    console.log('✓ Transcript saved');

    const decisionRows = (insights.decisions || [])
      .filter((d: any) => {
        if (!d) return false;
        if (typeof d === 'string') return d.trim().length > 0;
        if (typeof d === 'object' && (d.what || d.content || d.text)) {
          const text = d.what || d.content || d.text;
          return typeof text === 'string' && text.trim().length > 0;
        }
        return false;
      })
      .map((decision: string | any) => ({
        meeting_id: meeting.id,
        type: 'decision',
        content: typeof decision === 'string' ? decision.trim() : (decision.what || decision.content || JSON.stringify(decision)).trim(),
        ...(userId && { user_id: userId }),
      }));

    if (decisionRows.length) {
      const { error: decisionsError } = await supabaseServer.from('insights').insert(decisionRows);
      if (decisionsError) {
        console.error('✗ Decisions insert failed:', decisionsError);
        // Don't throw - continue without decisions
        console.warn('⚠ Continuing without decisions...');
      } else {
        console.log('✓ Decisions saved:', decisionRows.length);
      }
    } else {
      console.log('⚠ No decisions to save');
    }

    const actionRows = (insights.action_items || []).map((item: ActionItem) => ({
      meeting_id: meeting.id,
      type: 'action_item',
      content: item.what,
      assignee: item.who,
      due_date: item.due_date,
      ...(userId && { user_id: userId }),
    }));

    if (actionRows.length) {
      const { error: actionsError } = await supabaseServer.from('insights').insert(actionRows);
      if (actionsError) {
        // Backward compatibility: some schemas don't have a due_date column.
        if (actionsError.message.includes('due_date')) {
          console.log('⚠ Retrying actions without due_date column');
          const fallbackRows = actionRows.map(({ due_date, ...row }) => row);
          const { error: fallbackError } = await supabaseServer.from('insights').insert(fallbackRows);
          if (fallbackError) {
            console.error('✗ Actions insert fallback failed:', fallbackError);
            throw fallbackError;
          }
        } else {
          console.error('✗ Actions insert failed:', actionsError);
          throw actionsError;
        }
      }
      console.log('✓ Actions saved:', actionRows.length);
    }

    const persistedSentimentRows = buildSentimentRows(transcript, meeting.id);
    await insertSentimentWithFallback(persistedSentimentRows);
    console.log('✓ Sentiment data saved:', persistedSentimentRows.length);

    console.log('=== Analyze API Success ===');
    return NextResponse.json({
      success: true,
      data: {
        ...meeting,
        id: meeting.id,
        file_name: fileName || `${meetingName || 'transcript'}.txt`,
        speaker_count: speakerCount,
        segment_count: segmentCount,
        avg_sentiment: averageSentiment,
        meeting_date: meeting.meeting_date || meetingDate,
        word_count: meeting.word_count || words,
        intelligence: insights,
      },
    });

  } catch (error: unknown) {
    console.error('=== Analyze API Error ===');
    
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    } else {
      console.error('Unknown error type:', error);
    }
    
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: unknown }).message || 'Unknown server error')
          : typeof error === 'string'
            ? error
            : 'Unknown server error';
    console.error('Returning error to client:', message);
    
    return NextResponse.json({ 
      error: message,
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}