/**
 * Convert any input to string safely
 */
function toString(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    // Try to extract text from object
    if (value.what) return value.what;
    if (value.content) return value.content;
    if (value.text) return value.text;
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Generate a clear 2-3 line summary from meeting insights
 * FORMAT: Why we met | What we decided
 */
export async function generateMeetingSummary(
  insights: {
    meeting_topic?: string;
    meeting_purpose?: string;
    decisions?: any[];
    nextSteps?: any[];
    keyPoints?: any[];
  } | null,
  transcript?: string
): Promise<string> {
  if (!insights && !transcript) {
    return 'Meeting transcript available for review.';
  }

  if (!insights || (!insights.decisions?.length && !insights.nextSteps?.length)) {
    return 'Team had a discussion and reviewed the transcript for details.';
  }

  let summary = '';

  // PART 1: WHY WE MET (Meeting Purpose)
  if (insights.meeting_purpose) {
    summary = `Why: ${insights.meeting_purpose}. `;
  } else if (insights.meeting_topic) {
    summary = `Why: Meeting on ${insights.meeting_topic}. `;
  }

  // PART 2: WHAT WE DECIDED (Key Decisions)
  const mainDecisions = (insights.decisions || [])
    .map(toString)
    .filter(d => d && d.trim())
    .slice(0, 2);

  if (mainDecisions.length > 0) {
    summary += 'Decided: ';
    if (mainDecisions.length === 1) {
      const decision = mainDecisions[0].toLowerCase().replace(/^(decided|we|to|the team)\s+/i, '');
      summary += decision;
    } else {
      summary += mainDecisions
        .map(d => d.toLowerCase().replace(/^(decided|we|to|the team)\s+/i, ''))
        .join(', and ');
    }
  }

  // Ensure it ends naturally
  if (summary && !summary.match(/[.!?]$/)) {
    summary += '.';
  }

  return summary.trim();
}
