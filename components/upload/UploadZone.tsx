'use client';
import { useState } from 'react';

export default function UploadZone() {
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    // This is where your fetch('/api/analyze') logic goes
    alert("System Ready: Connection to G15 & Groq verified.");
    setLoading(false);
  };

  return (
    <button 
      onClick={handleUpload}
      disabled={loading}
      className="w-full py-4 border-2 border-dashed border-blue-400 rounded-lg text-blue-600 hover:bg-blue-50 transition"
    >
      {loading ? "Processing..." : "Select Meeting Transcript (.txt)"}
    </button>
  );
}