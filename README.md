# Meeting Intelligence Hub (MeetingAI)

## The Problem
Corporate professionals and project teams lose hours every week manually documenting meeting minutes and chasing down action items. Important decisions often get buried in long transcripts, and the emotional context (e.g., team burnout or conflict) is completely lost in text-based summaries. Nobody has the time to read through full transcripts to find one specific detail. 

## The Solution
MinAI is a hybrid AI-powered intelligence platform that transforms raw meeting audio/transcripts into actionable insights. It provides a "zero-read" experience through:
- **Automated Minutes:** Instant extraction of Executive Summaries, Decisions, and Action Items. 
- **Sentiment Heatmaps:** Visual indicators of team morale and meeting health.
- **Global Context Chat:** A RAG-based chatbot that answers questions across all your previous meetings.
- **Hybrid Processing:** Toggle between local (Ollama) and cloud (Groq) models for data privacy and speed.

## Tech Stack
- **Framework:** Next.js 14 (App Router) 
- **Language:** TypeScript/JavaScript 
- **Backend/Database:** Supabase (Auth, PostgreSQL, Vector Store) 
- **AI Models:** Ollama (Local G15 Server) & Groq (Cloud Failover) 
- **UI:** Tailwind CSS, Shadcn/UI, Lucide React

## Setup Instructions
1. **Clone the repository:**
   ```bash
   git clone [https://github.com/Rinu-sunny/Meeting-Intelligence-Hub.git]
2. **Install dependencies:**
    ```bash
    npm install
3. **Run locally:** 
   ```bash
     npm run dev
   
5. Local AI Setup (Ollama)
   To run the intelligence engine locally:
   1. **Install Ollama:** Download from [ollama.com](https://ollama.com).
   2. **Pull the Model:** Open your terminal and run the model you've configured (e.g., Llama 3.2):
      ```bash
      ollama pull llama3.2
    3.**Keep the Server Running:** Ensure the Ollama app is active in your system tray
       or
      ```bash
      run ollama serve.
The project connects via http://localhost:11434.
  
