import UploadZone from '@/components/upload/UploadZone';

export default function Home() {
  return (
    <main className="min-h-screen p-24 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-slate-900">Meeting Intelligence Hub</h1>
        <p className="text-lg text-slate-600 mt-2">Hybrid AI Meeting Intelligence</p>
        
        <div className="mt-10 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-semibold mb-4">Upload Transcript</h2>
          <UploadZone />
        </div>
      </div>
    </main>
  );
}