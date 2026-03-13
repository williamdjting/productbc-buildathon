"use client";

import { useRouter } from "next/navigation";

interface StepHeaderProps {
  step: 1 | 2 | 3;
  onBack?: () => void;
}

export default function StepHeader({ step, onBack }: StepHeaderProps) {
  const router = useRouter();

  function handleBack() {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  }

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="w-16">
        {step > 1 && (
          <button
            onClick={handleBack}
            className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors"
          >
            ← Back
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                n === step
                  ? "bg-blue-600 text-white"
                  : n < step
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 text-gray-400"
              }`}
            >
              {n < step ? "✓" : n}
            </div>
            {n < 3 && (
              <div
                className={`w-8 h-0.5 ${
                  n < step ? "bg-green-500" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="w-16 text-right">
        <span className="text-xs text-gray-400">Step {step} of 3</span>
      </div>
    </div>
  );
}
