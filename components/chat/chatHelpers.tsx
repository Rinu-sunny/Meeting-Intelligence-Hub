import React, { useState } from 'react';

export type ChatSource = {
  meetingId: string;
  meetingName: string;
  snippet: string;
  citationIndex?: number;
};

type CitationTooltipProps = {
  citationIndex: number;
  snippet: string;
  meetingName: string;
};

function CitationTooltip({ citationIndex, snippet, meetingName }: CitationTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <span className="text-indigo-600 font-semibold cursor-help hover:underline">[{citationIndex}]</span>
      {isVisible && (
        <div className="absolute z-50 bottom-full left-0 mb-2 w-72 p-3 bg-gray-900 text-white rounded-lg shadow-lg text-xs leading-relaxed pointer-events-none">
          <p className="font-semibold text-indigo-300 mb-1">{meetingName}</p>
          <p className="text-gray-100 italic">&quot;{snippet}&quot;</p>
          <div className="absolute top-full left-4 w-2 h-2 bg-gray-900 transform rotate-45 -mt-1" />
        </div>
      )}
    </span>
  );
}

export function deduplicateSources(sources: ChatSource[] = []): ChatSource[] {
  const seen = new Set<string>();
  const deduplicated: ChatSource[] = [];

  sources.forEach((source) => {
    const key = `${source.snippet.substring(0, 50)}|${source.meetingId}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push({ ...source, citationIndex: deduplicated.length + 1 });
    }
  });

  return deduplicated;
}

export function generateFollowUpSuggestions(content: string, sources: ChatSource[] = []): string[] {
  const suggestions: string[] = [];
  const speakers = new Set<string>();

  sources.forEach((source) => {
    source.snippet.split('\n').forEach((line) => {
      const match = line.trim().match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*:/);
      if (match) {
        const name = match[1];
        if (!/^(The|This|Meeting|Decision|Action|Next|Summary)$/.test(name)) {
          speakers.add(name);
        }
      }
    });
  });

  if (/speaker|attend|particip|who|present/i.test(content)) {
    if (speakers.size > 0) {
      const speakerArray = Array.from(speakers).slice(0, 3);
      suggestions.push(`Show me details about ${speakerArray[0]}'s comments`);
    }
  } else if (speakers.size > 0) {
    const speakerArray = Array.from(speakers).slice(0, 1);
    suggestions.push(`What did ${speakerArray[0]} mention?`);
  }

  if (content.toLowerCase().includes('risk') || content.toLowerCase().includes('issue')) {
    suggestions.push('What are the mitigation strategies?');
  }

  if (content.toLowerCase().includes('action') || content.toLowerCase().includes('task')) {
    suggestions.push('Who is responsible for completion?');
  }

  if (content.toLowerCase().includes('decision')) {
    suggestions.push('What was the reasoning?');
  }

  if (!suggestions.length) {
    suggestions.push('Tell me more about this.');
    suggestions.push('Who needs to know about this?');
  }

  return suggestions.slice(0, 3);
}

export function renderContentWithCitations(content: string, sources: ChatSource[] = []): React.ReactNode {
  const citationRegex = /\[(\d+)\]/g;
  let lastIndex = 0;
  const parts: React.ReactNode[] = [];

  let match;
  while ((match = citationRegex.exec(content)) !== null) {
    const citationNum = parseInt(match[1], 10);
    const source = sources[citationNum - 1];

    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    if (source) {
      parts.push(
        <CitationTooltip
          key={`citation-${match.index}`}
          citationIndex={citationNum}
          snippet={source.snippet}
          meetingName={source.meetingName}
        />
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return parts.length > 0 ? parts : content;
}

function normalizeStructuredContent(content: string): string {
  return content
    .replace(/\s+##\s+/g, '\n## ')
    .replace(/\s+\*\s+/g, '\n* ')
    .trim();
}

export function shouldRenderMarkdown(content: string): boolean {
  return /(^|\n)\s*##\s*|(^|\n)\s*\*\s+|\s##\s+|\s\*\s+/.test(content);
}

export function renderMarkdownContent(content: string, sources: ChatSource[] = []): React.ReactNode {
  const normalizedContent = normalizeStructuredContent(content);
  const lines = normalizedContent.split('\n');
  const elements: React.ReactNode[] = [];
  let currentBullets: string[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('##')) {
      if (currentBullets.length > 0) {
        elements.push(
          <ul key={`bullets-${idx}`} className="list-disc list-inside mb-3 space-y-1">
            {currentBullets.map((bullet, bidx) => (
              <li key={bidx} className="text-sm">
                {renderContentWithCitations(bullet, sources)}
              </li>
            ))}
          </ul>
        );
        currentBullets = [];
      }

      const heading = trimmed.replace(/^##\s*/, '');
      elements.push(
        <h3 key={idx} className="font-bold text-gray-900 mt-3 mb-2">
          {heading}
        </h3>
      );
    } else if (trimmed.startsWith('*')) {
      currentBullets.push(trimmed.replace(/^\*\s*/, ''));
    } else if (trimmed !== '') {
      if (currentBullets.length > 0) {
        elements.push(
          <ul key={`bullets-${idx}`} className="list-disc list-inside mb-3 space-y-1">
            {currentBullets.map((bullet, bidx) => (
              <li key={bidx} className="text-sm">
                {renderContentWithCitations(bullet, sources)}
              </li>
            ))}
          </ul>
        );
        currentBullets = [];
      }

      elements.push(
        <p key={`para-${idx}`} className="text-sm mb-2">
          {renderContentWithCitations(trimmed, sources)}
        </p>
      );
    } else if (trimmed === '' && currentBullets.length > 0) {
      elements.push(
        <ul key={`bullets-${idx}`} className="list-disc list-inside mb-3 space-y-1">
          {currentBullets.map((bullet, bidx) => (
            <li key={bidx} className="text-sm">
              {renderContentWithCitations(bullet, sources)}
            </li>
          ))}
        </ul>
      );
      currentBullets = [];
    }
  });

  if (currentBullets.length > 0) {
    elements.push(
      <ul key="bullets-final" className="list-disc list-inside mb-3 space-y-1">
        {currentBullets.map((bullet, bidx) => (
          <li key={bidx} className="text-sm">
            {renderContentWithCitations(bullet, sources)}
          </li>
        ))}
      </ul>
    );
  }

  return elements.length > 0 ? elements : renderContentWithCitations(content, sources);
}
