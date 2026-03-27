"use client";

import type { ContentTypeOrAuto } from "@/lib/types";

const OPTIONS: {
  value: ContentTypeOrAuto;
  label: string;
  description: string;
}[] = [
  { value: "auto", label: "Auto-detect", description: "Claude identifies the type" },
  { value: "blog", label: "Blog post", description: "Educational, long-form" },
  { value: "product", label: "Product page", description: "Ecommerce, SaaS features" },
  { value: "landing", label: "Landing page", description: "Marketing, lead gen" },
  { value: "howto", label: "How-to guide", description: "Tutorials, step-by-step" },
  { value: "news", label: "News / editorial", description: "Journalism, press releases" },
];

interface ContentTypeSelectorProps {
  value: ContentTypeOrAuto;
  onChange: (value: ContentTypeOrAuto) => void;
  disabled?: boolean;
}

export default function ContentTypeSelector({
  value,
  onChange,
  disabled,
}: ContentTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-[#6B7A99] uppercase tracking-wider">
        Content type
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex flex-col gap-0.5 border rounded-lg p-3 cursor-pointer transition-all ${
              value === opt.value
                ? "border-[#00D4A8]/50 bg-[rgba(0,212,168,0.07)]"
                : "border-white/[0.07] bg-[#0C1018] hover:border-white/[0.14] hover:bg-[#121820]"
            } ${disabled ? "opacity-40 pointer-events-none" : ""}`}
          >
            <input
              type="radio"
              className="sr-only"
              name="contentType"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              disabled={disabled}
            />
            <span
              className={`text-sm font-semibold transition-colors ${
                value === opt.value ? "text-[#00D4A8]" : "text-[#D4DBE8]"
              }`}
            >
              {opt.label}
            </span>
            <span className="text-xs text-[#4A5670]">{opt.description}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
