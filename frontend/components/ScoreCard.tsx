
'use client';

interface ScoreCardProps {
  score: number;        // 0–100
  candidateName: string;
  jobTitle: string;
}

export default function ScoreCard({
  score,
  candidateName,
  jobTitle,
}: ScoreCardProps) {

  // Determine color theme based on score range:
  // 70–100 = green (good match)
  // 40–69  = amber (partial match)
  // 0–39   = red   (poor match)
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-amber-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-green-50 border-green-200';
    if (score >= 40) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'Strong Match';
    if (score >= 40) return 'Partial Match';
    return 'Low Match';
  };

  return (
    <div className={`
      rounded-2xl border-2 p-8
      flex flex-col items-center gap-4
      ${getScoreBg(score)}
    `}>

      {/* Big score number */}
      <div className={`text-7xl font-bold ${getScoreColor(score)}`}>
        {score}%
      </div>

      {/* Label below the score */}
      <div className={`text-lg font-semibold ${getScoreColor(score)}`}>
        {getScoreLabel(score)}
      </div>

      {/* Thin divider line */}
      <div className="w-full border-t border-gray-200" />

      {/* Candidate info */}
      <div className="text-center space-y-1">
        <p className="text-gray-500 text-sm">Candidate</p>
        <p className="font-semibold text-gray-800">{candidateName}</p>
      </div>

      <div className="text-center space-y-1">
        <p className="text-gray-500 text-sm">Applying for</p>
        <p className="font-semibold text-gray-800">{jobTitle}</p>
      </div>
    </div>
  );
}