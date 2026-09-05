import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { Overview } from './pages/Overview';
import { StateAnalysis } from './pages/StateAnalysis';
import { WorkExplorer } from './pages/WorkExplorer';
import { WorkDetail } from './pages/WorkDetail';
import { SystemInfo } from './pages/SystemInfo';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/states" element={<StateAnalysis />} />
            <Route path="/explorer" element={<WorkExplorer />} />
            <Route path="/work/:workId" element={<WorkDetail />} />
            <Route path="/system" element={<SystemInfo />} />
            <Route path="*" element={
              <div className="p-8 text-center text-slate-400">
                <p className="text-lg font-semibold">Page not found</p>
                <a href="/" className="text-indigo-600 hover:underline text-sm mt-2 inline-block">← Back to Overview</a>
              </div>
            } />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
