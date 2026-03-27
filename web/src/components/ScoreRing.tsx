interface ScoreRingProps {
  score: number;
  label: string;
  size?: number;
}

export default function ScoreRing({ score, label, size = 110 }: ScoreRingProps) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.min(Math.max(score, 0), 100);
  const strokeDashoffset = circumference * (1 - clampedScore / 100);

  const color =
    clampedScore >= 75
      ? "#00D4A8"
      : clampedScore >= 50
      ? "#F59E0B"
      : "#F43F5E";

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
          stroke="#1A2535"
          strokeWidth="8"
        />
        {/* Progress */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 50 50)"
          style={{
            transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.3s ease",
            filter: `drop-shadow(0 0 6px ${color}60)`,
          }}
        />
        {/* Score number */}
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="22"
          fontWeight="700"
          fill={color}
          fontFamily="var(--font-syne)"
        >
          {clampedScore}
        </text>
      </svg>
      <p className="text-xs font-semibold text-[#4A5670] text-center tracking-widest uppercase">
        {label}
      </p>
    </div>
  );
}
