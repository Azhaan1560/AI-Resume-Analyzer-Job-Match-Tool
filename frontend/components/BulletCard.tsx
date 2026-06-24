'use client';

interface BulletCardProps {
  bullet: string;   // The improved bullet point text
  index: number;    // Position number (1, 2, 3...)
}

export default function BulletCard({ bullet, index }: BulletCardProps) {
  return (
    <div className="
      flex items-start gap-4
      p-4 rounded-xl
      bg-white border border-gray-100
      shadow-sm
    ">
      {/* Number badge on the left */}
      <span className="
        flex-shrink-0
        w-7 h-7
        rounded-full
        bg-indigo-100 text-indigo-700
        flex items-center justify-center
        text-sm font-bold
      ">
        {index}
      </span>

      {/* Bullet text */}
      <p className="text-gray-700 leading-relaxed text-sm">
        {bullet}
      </p>
    </div>
  );
}