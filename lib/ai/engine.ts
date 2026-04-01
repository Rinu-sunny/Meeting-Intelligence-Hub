// /lib/ai/engine.ts

export interface ActionItem {
  who: string;
  what: string;
  due_date: string;
}

export interface MeetingIntelligence {
  decisions: string[];
  action_items: ActionItem[];
}

export async function getAIAnalysis(transcript: string): Promise<MeetingIntelligence> {
  const strategy = process.env.NEXT_PUBLIC_AI_STRATEGY || 'local';
  
  // 1. One-Shot Prompting: This forces the model to follow our exact schema.
  const systemPrompt = `
    Analyze this transcript and extract decisions and action items.
    
    REQUIRED JSON FORMAT:
    {
      "decisions": ["string"],
      "action_items": [
        { "who": "string", "what": "string", "due_date": "string" }
      ]
    }

    EXAMPLE:
    Transcript: "John will fix the bug by Friday."
    Output: { 
      "decisions": [], 
      "action_items": [{ "who": "John", "what": "Fix the bug", "due_date": "Friday" }] 
    }

    Transcript: ${transcript}
  `;

  try {
    let rawResponse = "";

    if (strategy === 'local') {
      // --- OLLAMA (Your Dell G15) ---
      const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434";
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3.2",
          prompt: systemPrompt,
          stream: false,
          format: "json"
        }),
      });

      if (!response.ok) throw new Error("G15 Ollama server is not responding.");
      const data = await response.json();
      rawResponse = data.response;

    } else {
      // --- GROQ (Cloud Failover) ---
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: systemPrompt }],
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) throw new Error("Groq API error.");
      const data = await response.json();
      rawResponse = data.choices[0].message.content;
    }

    // 2. The Sanitizer: Removes any conversational text around the JSON.
    const startBracket = rawResponse.indexOf('{');
    const endBracket = rawResponse.lastIndexOf('}') + 1;
    const sanitizedJson = rawResponse.substring(startBracket, endBracket);
    const parsed = JSON.parse(sanitizedJson);

    // 3. Normalization: Guarantees the frontend never receives 'undefined'.
    return {
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      action_items: Array.isArray(parsed.action_items) 
        ? parsed.action_items.map((item: any) => ({
            who: item.who || "Unassigned",
            what: item.what || "No description",
            due_date: item.due_date || "TBD"
          }))
        : [] 
    };

  } catch (error) {
    console.error("AI Engine Error:", error);
    return {
      decisions: ["AI failed to process. Check if Ollama is running."],
      action_items: []
    };
  }
}