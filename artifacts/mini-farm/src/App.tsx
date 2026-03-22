import { useState, useCallback, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import FarmGame from "@/pages/farm-game";
import AdminPage from "@/pages/admin";
import NotFound from "@/pages/not-found";
import { SplashScreen } from "@/components/game/SplashScreen";
import { initTelegramApp } from "@/lib/telegram";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    },
  },
});

function HomePage() {
  const [splashDone, setSplashDone] = useState(false);
  const dismiss = useCallback(() => setSplashDone(true), []);

  return (
    <>
      {splashDone && <FarmGame />}
      {!splashDone && (
        <SplashScreen
          onPlay={dismiss}
          onSettings={dismiss}
          onAchievements={dismiss}
        />
      )}
    </>
  );
}

function App() {
  // Initialize Telegram theme + safe-area + viewport height as early as possible
  useEffect(() => {
    initTelegramApp();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/admin" component={AdminPage} />
            <Route component={NotFound} />
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
