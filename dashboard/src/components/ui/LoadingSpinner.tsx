export function LoadingSpinner({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

export function InlineSpinner() {
  return (
    <div className="w-4 h-4 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin inline-block" />
  );
}
