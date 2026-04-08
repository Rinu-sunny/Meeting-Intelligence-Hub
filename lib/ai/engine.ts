// /lib/ai/engine.ts

export interface ActionItem {
  who: string;
  what: string;
  due_date: string;
}

export interface MeetingIntelligence {
  meeting_topic?: string;
  meeting_purpose?: string;
  decisions: string[];
  action_items: ActionItem[];
  error_context?: {
    source: 'ollama' | 'groq' | 'fallback' | 'unknown';
    error_type?: string;
    message?: string;
  };
}

// Error Classification Types
type ErrorType = 
  | 'ollama_timeout' 
  | 'ollama_connection' 
  | 'ollama_api'
  | 'groq_api' 
  | 'groq_rate_limit'
  | 'json_parse' 
  | 'validation' 
  | 'unknown';

type ErrorSource = 'ollama' | 'groq' | 'fallback' | 'unknown';

/**
 * Logs AI errors with context for debugging
 */
function logAIError(
  errorType: ErrorType,
  source: ErrorSource,
  details: Record<string, any>
) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    errorType,
    source,
    ...details,
  };
  
  console.error(`[AI_ERROR ${timestamp}]`, {
    type: errorType,
    source,
    details,
  });
  
  // Store in a dev-accessible way for debugging
  if (typeof window === 'undefined') {
    // Server-side: we can keep detailed logs
    console.debug('[AI_ERROR_CONTEXT]', JSON.stringify(logEntry));
  }
}

/**
 * Gets a user-friendly error message based on error type
 */
function getErrorMessage(errorType: ErrorType, source: ErrorSource): string {
  const messages: Record<ErrorType, string> = {
    ollama_timeout: 'Local AI service (Ollama) is slow to respond. Trying cloud service...',
    ollama_connection: 'Cannot connect to local AI service. Using cloud service...',
    ollama_api: 'Local AI service returned an error. Using cloud service...',
    groq_api: 'Cloud AI service is temporarily unavailable. Using fallback...',
    groq_rate_limit: 'Cloud AI service rate limit reached. Using fallback...',
    json_parse: 'AI response could not be parsed. Using fallback...',
    validation: 'AI response validation failed. Using fallback...',
    unknown: 'AI service encountered an unexpected error. Using fallback...',
  };
  
  return messages[errorType] || 'AI analysis skipped. Using fallback...';
}

export async function getAIAnalysis(transcript: string): Promise<MeetingIntelligence> {
  const strategy = process.env.NEXT_PUBLIC_AI_STRATEGY || 'local';
  const startTime = Date.now();
  
  const systemPrompt = `
    Analyze this transcript and extract key meeting information.
    
    REQUIRED JSON FORMAT:
    {
      "meeting_topic": "string - brief 5-10 word description of what the meeting was about",
      "meeting_purpose": "string - brief explanation of why they met up (e.g., project planning, status update, brainstorming, etc.)",
      "decisions": ["string"],
      "action_items": [
        { "who": "string", "what": "string", "due_date": "string" }
      ]
    }

    EXAMPLE:
    Transcript: "John will fix the bug by Friday. We met to plan next quarter's roadmap."
    Output: {
      "meeting_topic": "Q1 Roadmap Planning",
      "meeting_purpose": "Quarterly planning and task assignment",
      "decisions": ["Roadmap approved for Q1"], 
      "action_items": [{ "who": "John", "what": "Fix the bug", "due_date": "Friday" }] 
    }

    Transcript: ${transcript}
  `;

  try {
    let rawResponse = "";
    let aiSource: ErrorSource = 'unknown';

    if (strategy === 'local') {
      // ===== ATTEMPT 1: OLLAMA (Local) =====
      try {
        console.log('[AI] Attempting local Ollama service...');
        const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434";
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(`${ollamaUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama3.2",
            prompt: systemPrompt,
            stream: false,
            format: "json"
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorMsg = `Ollama returned ${response.status}: ${response.statusText}`;
          logAIError('ollama_connection', 'ollama', { 
            status: response.status,
            statusText: response.statusText,
            ollamaUrl 
          });
          throw new Error(errorMsg);
        }
        
        const data = await response.json();
        rawResponse = data.response;
        aiSource = 'ollama';
        console.log(`[AI] ✓ Ollama succeeded (${Date.now() - startTime}ms)`);

      } catch (ollamaError) {
        // Classify the error
        let errorType: ErrorType;
        if (ollamaError instanceof Error) {
          if (ollamaError.name === 'AbortError') {
            errorType = 'ollama_timeout';
            logAIError(errorType, 'ollama', { 
              message: 'Request timeout after 30s',
              transcriptLength: transcript.length
            });
          } else if (ollamaError.message.includes('ECONNREFUSED') || ollamaError.message.includes('Failed to fetch')) {
            errorType = 'ollama_connection';
            logAIError(errorType, 'ollama', { 
              message: ollamaError.message,
              ollamaUrl: process.env.NEXT_PUBLIC_OLLAMA_URL
            });
          } else {
            errorType = 'ollama_api';
            logAIError(errorType, 'ollama', { 
              message: ollamaError.message
            });
          }
        } else {
          errorType = 'unknown';
          logAIError(errorType, 'ollama', { error: ollamaError });
        }
        
        console.warn(`[AI] ✗ Ollama failed (${errorType}). Falling back to Groq...`);
        
        // Fallback to Groq if Ollama fails
        if (!process.env.GROQ_API_KEY) {
          console.warn('[AI] ✗ No Groq API key available. Returning empty analysis.');
          return { 
            meeting_topic: 'Unknown Topic',
            meeting_purpose: 'No AI analysis available',
            decisions: [], 
            action_items: [],
            error_context: {
              source: 'fallback',
              error_type: errorType,
              message: 'Local AI unavailable and no cloud service configured'
            }
          };
        }

        // ===== ATTEMPT 2: GROQ (Fallback from Ollama failure) =====
        console.log('[AI] Attempting Groq cloud service (fallback)...');
        try {
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

          if (!response.ok) {
            const responseText = await response.text();
            logAIError('groq_api', 'groq', {
              status: response.status,
              statusText: response.statusText,
              responsePreview: responseText.substring(0, 200)
            });
            throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
          }
          
          const data = await response.json();
          rawResponse = data.choices[0].message.content;
          aiSource = 'groq';
          console.log(`[AI] ✓ Groq succeeded (${Date.now() - startTime}ms)`);
        } catch (groqError) {
          if (groqError instanceof Error) {
            logAIError('groq_api', 'groq', { 
              message: groqError.message,
              originalOllamaError: (ollamaError as Error).message
            });
          } else {
            logAIError('unknown', 'groq', { groqError });
          }
          
          console.error('[AI] ✗ Both Ollama and Groq failed. Returning empty analysis.');
          return { 
            meeting_topic: 'Unknown Topic',
            meeting_purpose: 'No AI analysis available',
            decisions: [], 
            action_items: [],
            error_context: {
              source: 'fallback',
              error_type: 'unknown',
              message: 'Both local and cloud AI services failed'
            }
          };
        }
      }
    } else {
      // ===== GROQ (Cloud) - Primary Strategy =====
      console.log('[AI] Using Groq cloud service as primary...');
      if (!process.env.GROQ_API_KEY) {
        console.warn('[AI] ✗ No Groq API key available. Returning empty analysis.');
        return { 
          meeting_topic: 'Unknown Topic',
          meeting_purpose: 'No AI analysis available',
          decisions: [], 
          action_items: [],
          error_context: {
            source: 'fallback',
            error_type: 'validation',
            message: 'Groq API key not configured'
          }
        };
      }

      try {
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

        if (!response.ok) {
          const responseText = await response.text();
          
          // Check for rate limiting
          if (response.status === 429) {
            logAIError('groq_rate_limit', 'groq', {
              status: response.status,
              headers: Object.fromEntries(response.headers),
            });
          } else {
            logAIError('groq_api', 'groq', {
              status: response.status,
              statusText: response.statusText,
              responsePreview: responseText.substring(0, 200)
            });
          }
          throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        rawResponse = data.choices[0].message.content;
        aiSource = 'groq';
        console.log(`[AI] ✓ Groq succeeded (${Date.now() - startTime}ms)`);
      } catch (groqError) {
        if (groqError instanceof Error) {
          logAIError('groq_api', 'groq', { 
            message: groqError.message
          });
        } else {
          logAIError('unknown', 'groq', { groqError });
        }
        
        console.error('[AI] ✗ Groq cloud service failed. Returning empty analysis.');
        return { 
          meeting_topic: 'Unknown Topic',
          meeting_purpose: 'No AI analysis available',
          decisions: [], 
          action_items: [],
          error_context: {
            source: 'fallback',
            error_type: 'unknown',
            message: 'Cloud AI service failed'
          }
        };
      }
    }

    // ===== PARSE & NORMALIZE RESPONSE =====
    try {
      // Sanitize: Remove any conversational text around the JSON
      const startBracket = rawResponse.indexOf('{');
      const endBracket = rawResponse.lastIndexOf('}') + 1;
      
      if (startBracket === -1 || endBracket <= startBracket) {
        logAIError('json_parse', aiSource, {
          rawResponsePreview: rawResponse.substring(0, 500),
          noJsonFound: true
        });
        throw new Error('No JSON object found in response');
      }
      
      const sanitizedJson = rawResponse.substring(startBracket, endBracket);
      const parsed = JSON.parse(sanitizedJson);

      // Validate structure
      if (!parsed.decisions && !parsed.action_items) {
        logAIError('validation', aiSource, {
          parsedKeys: Object.keys(parsed)
        });
        throw new Error('Response missing required fields');
      }

      // Normalize: Guarantees frontend never receives 'undefined' and filters empty decisions
      const sanitizedDecisions = Array.isArray(parsed.decisions)
        ? parsed.decisions
            .map((d: any) => typeof d === 'string' ? d.trim() : d)
            .filter((d: any) => d && (typeof d === 'string' ? d.length > 0 : true))
        : [];
      
      const result = {
        meeting_topic: (parsed.meeting_topic || 'Meeting Discussion').trim(),
        meeting_purpose: (parsed.meeting_purpose || 'Team collaboration').trim(),
        decisions: sanitizedDecisions,
        action_items: Array.isArray(parsed.action_items) 
          ? parsed.action_items.map((item: any) => ({
              who: (item.who || "Unassigned").trim(),
              what: (item.what || "No description").trim(),
              due_date: (item.due_date || "TBD").trim()
            }))
            .filter((item: any) => item.what && item.what.length > 0)
          : [] 
      };

      console.log(`[AI] ✓ Analysis complete from ${aiSource} (${Date.now() - startTime}ms)`, {
        decisions: result.decisions.length,
        actions: result.action_items.length,
      });

      return result;
    } catch (parseError) {
      if (parseError instanceof SyntaxError) {
        logAIError('json_parse', aiSource, {
          message: parseError.message,
          rawResponsePreview: rawResponse.substring(0, 500)
        });
      } else if (parseError instanceof Error) {
        logAIError('validation', aiSource, {
          message: parseError.message
        });
      } else {
        logAIError('unknown', aiSource, { parseError });
      }
      
      console.error(`[AI] ✗ Failed to parse response from ${aiSource}`);
      return { 
        meeting_topic: 'Unknown Topic',
        meeting_purpose: 'No AI analysis available',
        decisions: [], 
        action_items: [],
        error_context: {
          source: aiSource,
          error_type: 'json_parse',
          message: 'AI response could not be parsed'
        }
      };
    }

  } catch (error) {
    console.error("[AI] Unexpected error in getAIAnalysis:", error);
    logAIError('unknown', 'unknown', { 
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Last resort fallback - let the meeting be created even without AI insights
    return {
      meeting_topic: 'Unknown Topic',
      meeting_purpose: 'No AI analysis available',
      decisions: [],
      action_items: [],
      error_context: {
        source: 'fallback',
        error_type: 'unknown',
        message: 'AI analysis encountered an unexpected error'
      }
    };
  }
}