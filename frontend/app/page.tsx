// app/page.tsx
// ─────────────────────────────────────────────────────────────
// The home page — the first thing users see.
// URL: http://localhost:3000/
//
// In Next.js 14 App Router, every folder inside app/ that has
// a page.tsx becomes a URL route automatically:
//   app/page.tsx         →  localhost:3000/
//   app/results/page.tsx →  localhost:3000/results
//
// This page shows the upload form. When analysis is done,
// it saves the result and navigates to /results.
// ─────────────────────────────────────────────────────────────

'use client';

// useRouter lets us navigate to another page programmatically
// (without the user clicking a link)
import { useRouter } from 'next/navigation';
import UploadForm from '../components/UploadForm';
import { AnalysisResult } from '../lib/types';

export default function HomePage() {
  // useRouter gives us a router object with a .push() method
  const router = useRouter();

  // Called by UploadForm when the API returns successfully
  const handleSuccess = (result: AnalysisResult) => {
    // sessionStorage stores data for the duration of the browser session.
    // We use it to pass results to the /results page without
    // putting them in the URL (which would expose data).
    // JSON.stringify converts the object to a string for storage.
    sessionStorage.setItem('analysisResult', JSON.stringify(result));

    // Navigate to the results page
    router.push('/results');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <div className="max-w-3xl mx-auto px-4 py-16">

        {/* ── HEADER ──────────────────────────────────────── */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            AI Resume Analyzer
          </h1>
          <p className="text-gray-500 text-lg">
            Upload your resume and a job description.
            <br />
            Get your match score and AI-improved bullet points instantly.
          </p>
          {/* Small badge showing it's free and local */}
          <span className="
            inline-block mt-4
            px-4 py-1 rounded-full
            bg-indigo-100 text-indigo-700
            text-sm font-medium
          ">
            Powered by Gemini
          </span>
        </div>

        {/* ── UPLOAD FORM ─────────────────────────────────── */}
        <div className="
          bg-white rounded-2xl
          shadow-sm border border-gray-100
          p-8
        ">
          {/* Pass handleSuccess so the form can tell us when done */}
          <UploadForm onSuccess={handleSuccess} />
        </div>

      </div>
    </main>
  );
}