import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navbar } from '@/components/layout/Navbar';
import { Home } from '@/pages/Home';
import { Setup } from '@/pages/Setup';
import { Viva } from '@/pages/Viva';
import { Report } from '@/pages/Report';
import { History } from '@/pages/History';
import { Progress } from '@/pages/Progress';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function NotFoundPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 text-center">
      <div className="rounded-2xl border border-border bg-paper p-10 shadow-sm max-w-lg mx-auto">
        <h2 className="font-heading text-3xl font-bold text-primary mb-2">404</h2>
        <h3 className="font-heading text-lg font-bold text-ink mb-2">Page Not Found</h3>
        <p className="text-xs text-muted mb-6">
          The page you requested doesn&apos;t exist or has moved. Return home to continue your DSA interview prep.
        </p>
        <Link
          to="/"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-paper hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-opacity"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-background text-ink font-sans">
          <Navbar />
          <main className="flex-1 pb-16 md:pb-0">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/viva/:id" element={<Viva />} />
              <Route path="/report/:id" element={<Report />} />
              <Route path="/history" element={<History />} />
              <Route path="/progress" element={<Progress />} />
              {/* Catch-all route showing friendly Page Not Found (Section 10) */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
