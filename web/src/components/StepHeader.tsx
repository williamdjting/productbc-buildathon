"use client";

import { useRouter } from "next/navigation";

interface StepHeaderProps {
  step: 1 | 2 | 3;
  onBack?: () => void;
}

export default function StepHeader({ step, onBack }: StepHeaderProps) {
  const router = useRouter();

  function handleBack() {
    if (onBack) onBack();
    else router.back();
  }

  return (
    <div className="sticky top-0 z-10 bg-[#0C1018]/90 backdrop-blur-md border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
      {/* Logo / back */}
      <div className="w-24">
        {step > 1 ? (
          <button
            onClick={handleBack}
            className="text-sm text-[#6B7A99] hover:text-[#ECF0F8] flex items-center gap-1.5 transition-colors"
          >
            ← Back
          </button>
        ) : (
          <span className="font-display font-bold text-sm tracking-widest text-[#00D4A8]">
            CR
          </span>
        )}
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2">
        {([1, 2, 3] as const).map((n) => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                n === step
                  ? "bg-[#00D4A8] text-[#03100D]"
                  : n < step
                  ? "bg-[#00D4A8]/20 text-[#00D4A8]"
                  : "bg-white/[0.05] text-[#3D4A60]"
              }`}
            >
              {n < step ? "✓" : n}
            </div>
            {n < 3 && (
              <div
                className={`w-8 h-px ${
                  n < step ? "bg-[#00D4A8]/40" : "bg-white/[0.07]"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="w-24 text-right">
        <span className="text-xs text-[#3D4A60]">Step {step} / 3</span>
      </div>
    </div>
  );
}
