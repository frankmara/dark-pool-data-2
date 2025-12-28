import { Switch, Route } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { GlobalTogglePanel } from "@/components/global-toggle-panel";
import type { AutomationSettings } from "@shared/schema";

import LiveAutomations from "@/pages/live-automations";
import PostAnalytics from "@/pages/post-analytics";
import PostConstructor from "@/pages/post-constructor";
import DataFeeds from "@/pages/data-feeds";
import WorkflowCanvas from "@/pages/workflow-canvas";
import Settings from "@/pages/settings";
import Help from "@/pages/help";
import NotFound from "@/pages/not-found";

interface AutomationToggles {
  masterEnabled: boolean;
  darkPoolScanner: boolean;
  unusualOptionsSweeps: boolean;
  autoThreadPosting: boolean;
  analyticsTracking: boolean;
}

function AppContent() {
  const { data: settings, isLoading } = useQuery<AutomationSettings>({
    queryKey: ['/api/settings/automation'],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<AutomationToggles>) => {
      return apiRequest('PATCH', '/api/settings/automation', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/automation'] });
    },
  });

  const toggles: AutomationToggles = {
    masterEnabled: settings?.masterEnabled ?? true,
    darkPoolScanner: settings?.darkPoolScanner ?? true,
    unusualOptionsSweeps: settings?.unusualOptionsSweeps ?? true,
    autoThreadPosting: settings?.autoThreadPosting ?? false,
    analyticsTracking: settings?.analyticsTracking ?? true,
  };

  const handleToggleChange = (key: keyof AutomationToggles, value: boolean) => {
    const updates: Partial<AutomationToggles> = { [key]: value };
    
    if (key === 'masterEnabled') {
      if (!value) {
        updates.darkPoolScanner = false;
        updates.unusualOptionsSweeps = false;
        updates.autoThreadPosting = false;
      } else {
        updates.darkPoolScanner = true;
        updates.unusualOptionsSweeps = true;
      }
    }
    
    updateSettingsMutation.mutate(updates);
  };

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full flex-col">
        <GlobalTogglePanel 
          toggles={toggles} 
          onToggleChange={handleToggleChange}
          isLoading={isLoading || updateSettingsMutation.isPending}
        />
        <div className="flex flex-1 min-h-0">
          <AppSidebar />
          <main className="flex-1 overflow-hidden">
            <Switch>
              <Route path="/">
                {() => <LiveAutomations toggles={toggles} />}
              </Route>
              <Route path="/analytics" component={PostAnalytics} />
              <Route path="/constructor" component={PostConstructor} />
              <Route path="/feeds" component={DataFeeds} />
              <Route path="/workflow" component={WorkflowCanvas} />
              <Route path="/settings" component={Settings} />
              <Route path="/help" component={Help} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
