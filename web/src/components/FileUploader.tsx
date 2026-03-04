"use client";

import { useRef, useState } from "react";

interface FileUploaderProps {
  onContent: (text: string, filename: string) => void;
  accept?: string;
  label?: string;
  disabled?: boolean;
}

export default function FileUploader({
  onContent,
  accept = ".txt,.md,.json,.html",
  label = "Drop a file or click to browse",
  disabled = false,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);

  async function handleFile(file: File) {
    const text = await file.text();
    setFilename(file.name);
    onContent(text, file.name);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
        dragging
          ? "border-blue-500 bg-blue-50"
          : "border-gray-300 hover:border-gray-400"
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <p className="text-sm text-gray-500">
        {filename ? (
          <span className="text-green-600 font-medium">{filename}</span>
        ) : (
          label
        )}
      </p>
      <p className="text-xs text-gray-400 mt-1">{accept}</p>
    </div>
  );
}
