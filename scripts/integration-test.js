// test-groq.js
require('dotenv').config({ path: '.env.local' });
 const API_KEY = process.env.GROQ_API_KEY; // Put your actual key here

async function test() {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "Say 'DB is alive' if you can read this." }],
      }),
    });

    const data = await response.json();
    console.log("GROQ RESPONSE:", data.choices[0].message.content);
  } catch (err) {
    console.error("GROQ ERROR:", err);
  }
}

test();
const { createClient } = require('@supabase/supabase-js');

// 1. Setup your credentials (Copy these from your Supabase Dashboard -> Settings -> API)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // Use the anon key for client-side operations

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function insertTestData() {
    console.log("🚀 Attempting to connect to Supabase...");

    // 2. The Insert Call (Matching your Meeting Intelligence schema)
    const { data, error } = await supabase
        .from('meetings') // Ensure your table is named 'meetings'
        .insert([
            { 
                name: 'Code Connection Test', 
                word_count: 42,
                // Add other columns your table requires here
            }
        ])
        .select();

    if (error) {
        console.error('❌ DB ERROR:', error.message);
        console.error('Details:', error.details);
    } else {
        console.log('✅ SUCCESS! Data inserted via code:');
        console.table(data);
        console.log("\nNow check your Supabase Dashboard to see the 'Code Connection Test' row!");
    }
}

insertTestData();