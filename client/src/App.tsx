import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import { TipContextProvider } from "@/context/TipContext";

function AppNav() {
  const [location] = useLocation();
  
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TipContextProvider>
          <div className="flex-grow w-full bg-[#2F4F4F] text-[#f5f5f5] min-h-screen flex flex-col">
            <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 flex-grow">
              <AppNav />
              <div className="flex-grow">
                <Router />
              </div>
            </main>
            <footer className="w-full border-t border-[#3A5F5F] mt-8 py-4">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-sm">
                <div className="font-medium text-[#f5f5f5]">Made by William Walsh</div>
                <div className="text-[#9fd6e9] text-xs mt-1">Starbucks Store# 69600</div>
              </div>
            </footer>
          </div>
          <Toaster />
        </TipContextProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
