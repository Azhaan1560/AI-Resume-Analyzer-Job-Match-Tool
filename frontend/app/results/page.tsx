// app/results/page.tsx
// ─────────────────────────────────────────────────────────────
// Results dashboard — shows the AI analysis after upload.
// URL: http://localhost:3000/results
//
// The home page stores the AnalysisResult in sessionStorage and
// navigates here. We read that data and render it with the
// ScoreCard, SkillBadge, and BulletCard components.
// ─────────────────────────────────────────────────────────────

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw } from 'lucide-react';

import ScoreCard from '../../components/ScoreCard';
import SkillBadge from '../../components/SkillBadge';
import BulletCard from '../../components/BulletCard';
import { AnalysisResult } from '../../lib/types';

export default function ResultsPage() {
  const router = useRouter();

  // Hold the analysis result loaded from sessionStorage.
  // null while loading, undefined if nothing was found.
  const [result, setResult] = useState<AnalysisResult | null | undefined>(null);

  useEffect(() => {
    // sessionStorage is only available in the browser, so we read it
    // inside useEffect (after the component mounts on the client).
    const stored = sessionStorage.getItem('analysisResult');

    if (!stored) {
      // No data means the user landed here directly. Redirect home.
      router.replace('/');
      return;
    }

    try {
      const parsed: AnalysisResult = JSON.parse(stored);
      setResult(parsed);
    } catch {
      // Corrupted data — clear it and send the user back home.
      sessionStorage.removeItem('analysisResult');
      router.replace('/');
    }
  }, [router]);

  // Loading state while we read from sessionStorage.
  if (result === null) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading results...</p>
        </div>
      </main>
    );
  }

  // If result is undefined, the redirect is in progress.
  if (result === undefined) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-12">

        {/* ── HEADER ──────────────────────────────────────── */}
        <button
          onClick={() => router.push('/')}
          className="
            flex items-center gap-2
            text-gray-600 hover:text-indigo-600
            transition-colors duration-200
            mb-8
          "
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to upload</span>
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Analysis Results
        </h1>

        {/* ── SCORE CARD ──────────────────────────────────── */}
        <div className="mb-10">
          <ScoreCard
            score={result.matchScore}
            candidateName={result.candidateName}
            jobTitle={result.jobTitle}
          />
        </div>


        {/* ── SKILLS BREAKDOWN ────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-8 mb-10">

          {/* Matched skills */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Matched Skills
            </h2>
            {result.matchedSkills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {result.matchedSkills.map((skill) => (
                  <SkillBadge key={skill} skill={skill} variant="matched" />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No required skills matched.</p>
            )}
          </div>

          {/* Missing skills */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Missing Skills
            </h2>
            {result.missingSkills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {result.missingSkills.map((skill) => (
                  <SkillBadge key={skill} skill={skill} variant="missing" />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Great job — no missing skills!</p>
            )}
          </div>
        </div>


        {/* ── IMPROVED BULLETS ────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            AI-Improved Bullet Points
          </h2>
          {result.improvedBullets.length > 0 ? (
            <div className="space-y-3">
              {result.improvedBullets.map((bullet, index) => (
                <BulletCard
                  key={index}
                  bullet={bullet}
                  index={index + 1}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No improved bullets were generated.</p>
          )}
        </div>


        {/* ── RESUME SKILLS ───────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Skills Found in Resume
          </h2>
          {result.resumeSkills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {result.resumeSkills.map((skill) => (
                <SkillBadge key={skill} skill={skill} variant="neutral" />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No skills extracted.</p>
          )}
        </div>

      </div>
    </main>
  );
}
