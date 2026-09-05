import { AlertTriangle } from 'lucide-react';

interface ErrorBannerProps {
  message?: string;
}

export function ErrorBanner({ message = 'Failed to load data. Please check your connection and try again.' }: ErrorBannerProps) {
  return (
    <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold">Error</p>
        <p className="text-sm mt-0.5">{message}</p>
      </div>
    </div>
  );
}
