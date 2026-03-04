"use client";

interface RevisedArticleProps {
  text: string;
  onDownload?: () => void;
}

export default function RevisedArticle({ text, onDownload }: RevisedArticleProps) {
  function handleCopy() {
    navigator.clipboard.writeText(text);
  }

  function handleDownload() {
    if (onDownload) {
      onDownload();
      return;
    }
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "revised-article.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 justify-end">
        <button
          onClick={handleCopy}
          className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
        >
          Copy
        </button>
        <button
          onClick={handleDownload}
          className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
        >
          Download
        </button>
      </div>
      <pre className="whitespace-pre-wrap text-xs font-mono bg-white text-black border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
        {text}
      </pre>
    </div>
  );
}
