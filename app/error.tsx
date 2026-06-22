"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto p-8 flex flex-col gap-4 text-center">
      <h2 className="text-lg font-semibold">エラーが発生しました</h2>
      <p className="text-sm text-muted-foreground break-words">{error.message}</p>
      <button
        onClick={reset}
        className="self-center px-4 py-2 rounded bg-foreground text-background text-sm"
      >
        再試行
      </button>
    </div>
  );
}
