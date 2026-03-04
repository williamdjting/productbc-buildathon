"use client";

interface CompareViewProps {
  text: string;
}

export default function CompareView({ text }: CompareViewProps) {
  return (
    <pre className="whitespace-pre-wrap text-xs font-mono bg-white text-black border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto leading-relaxed">
      {text}
    </pre>
  );
}
