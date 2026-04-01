require('dotenv').config({ path: './.env.local' });

async function testOllama() {
  console.log("🐢 Checking your G15 for Ollama...");
  
  const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434";

  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2",
        prompt: "Identify the action item: 'Gracykutty needs to submit the project by 12 AM.'",
        stream: false,
        format: "json"
      }),
    });

    if (!response.ok) throw new Error("Ollama is not responding. Is 'ollama serve' running?");

    const data = await response.json();
    console.log("✅ G15 LOCAL RESPONSE:");
    console.log(data.response);

  } catch (error) {
    console.error("❌ LOCAL AI ERROR:", error.message);
  }
}

testOllama();