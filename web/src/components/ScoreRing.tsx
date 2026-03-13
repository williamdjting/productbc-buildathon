interface ScoreRingProps {
  score: number;  // 0–100
  label: string;
  size?: number;  // px, default 110
}

export default function ScoreRing({ score, label, size = 110 }: ScoreRingProps) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.min(Math.max(score, 0), 100);
  const strokeDashoffset = circumference * (1 - clampedScore / 100);

  const color =
    clampedScore >= 75
      ? "#22c55e" // green-500
      : clampedScore >= 50
      ? "#f59e0b" // amber-500
      : "#ef4444"; // red-500

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="img"
        aria-label={`${label}: ${clampedScore} out of 100`}
      >
        {/* Track */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="10"
        />
        {/* Progress */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s ease" }}
        />
        {/* Score number */}
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="20"
          fontWeight="700"
          fill={color}
        >
          {clampedScore}
        </text>
      </svg>
      <p className="text-xs font-medium text-gray-500 text-center">{label}</p>
    </div>
  );
}
