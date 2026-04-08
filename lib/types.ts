export type Meeting = {
  id: string;
  name: string;
  word_count: number;
  created_at: string;
  project_group: string;
};

export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export type SentimentDataRow = {
  id: string;
  meeting_id: string;
  speaker_name: string;
  segment_timestamp: string;
  score: number;
  label: SentimentLabel;
  transcript_snippet: string;
};
