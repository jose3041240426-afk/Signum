export function ProgressBar({
  progress,
  total,
  label,
}: {
  progress: number;
  total: number;
  label?: string;
}) {
  const pct = Math.min(100, Math.max(0, (progress / total) * 100));
  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex justify-between text-sm font-medium text-gray-700">
          <span>{label}</span>
          <span>{progress}/{total}</span>
        </div>
      )}
      <div className="h-2.5 w-full rounded-full bg-gray-200">
        <div
          className="h-2.5 rounded-full bg-black transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
