# Meeting Intelligence Hub (MeetingAI)

## The Problem
Corporate professionals and project teams lose hours every week manually documenting meeting minutes and chasing down action items. Important decisions often get buried in long transcripts, and the emotional context (e.g., team burnout or conflict) is completely lost in text-based summaries. [cite_start]Nobody has the time to read through full transcripts to find one specific detail. [cite: 9]

## The Solution
MeetingAI is a hybrid AI-powered intelligence platform that transforms raw meeting audio/transcripts into actionable insights. It provides a "zero-read" experience through:
- [cite_start]**Automated Minutes:** Instant extraction of Executive Summaries, Decisions, and Action Items. [cite: 10]
- **Sentiment Heatmaps:** Visual indicators of team morale and meeting health.
- **Global Context Chat:** A RAG-based chatbot that answers questions across all your previous meetings.
- **Hybrid Processing:** Toggle between local (Ollama) and cloud (Groq) models for data privacy and speed.

## Tech Stack
- [cite_start]**Framework:** Next.js 14 (App Router) [cite: 15]
- [cite_start]**Language:** TypeScript/JavaScript [cite: 14]
- [cite_start]**Backend/Database:** Supabase (Auth, PostgreSQL, Vector Store) [cite: 16]
- [cite_start]**AI Models:** Ollama (Local G15 Server) & Groq (Cloud Failover) [cite: 17]
- **UI:** Tailwind CSS, Shadcn/UI, Lucide React

## Setup Instructions
1. **Clone the repository:**
   ```bash
   git clone [https://github.com/Rinu-sunny/Meeting-Intelligence-Hub.git]
2. **Install dependencies:**
  -npm install
3. **Run locally:**
  -npm run dev
  
