import { useEffect, useRef } from "react";
import { ClerkProvider, Show, useClerk, useAuth } from "@clerk/react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/app-layout";

import Dashboard from "@/pages/dashboard";
import Annotate from "@/pages/annotate";
import Posts from "@/pages/posts";
import Annotations from "@/pages/annotations";
import Coders from "@/pages/coders";
import Agreement from "@/pages/agreement";
import NotFound from "@/pages/not-found";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect to="/sign-in" />;

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/annotate" component={() => <ProtectedRoute component={Annotate} />} />
      <Route path="/posts" component={() => <ProtectedRoute component={Posts} />} />
      <Route path="/annotations" component={() => <ProtectedRoute component={Annotations} />} />
      <Route path="/coders" component={() => <ProtectedRoute component={Coders} />} />
      <Route path="/agreement" component={() => <ProtectedRoute component={Agreement} />} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
      appearance={{
        options: {
          logoPlacement: "inside",
          logoLinkUrl: basePath || "/",
          logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
        },
        variables: {
          colorPrimary: "#6366f1",
          colorBackground: "#ffffff",
          colorInputBackground: "#f8fafc",
          colorText: "#0f172a",
          colorTextSecondary: "#64748b",
          colorInputText: "#0f172a",
          colorNeutral: "#94a3b8",
          borderRadius: "0.5rem",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "14px",
        },
        elements: {
          rootBox: "w-full",
          cardBox: "shadow-xl border border-slate-200 rounded-2xl w-full overflow-hidden",
          card: "!shadow-none !border-0 !bg-transparent !rounded-none",
          footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
          headerTitle: { color: "#0f172a", fontWeight: "700" },
          headerSubtitle: { color: "#64748b" },
          formFieldLabel: { color: "#374151" },
          footerActionText: { color: "#64748b" },
          footerActionLink: { color: "#6366f1" },
          dividerText: { color: "#94a3b8" },
          alertText: { color: "#dc2626" },
          formFieldSuccessText: { color: "#16a34a" },
          formButtonPrimary: "bg-indigo-500 hover:bg-indigo-600 text-white",
          formFieldInput: "border-slate-200 focus:ring-indigo-500",
        },
      }}
      localization={{
        signIn: {
          start: {
            title: "Welcome to MoralizeAI",
            subtitle: "Sign in to access the annotation platform",
          },
        },
        signUp: {
          start: {
            title: "Join MoralizeAI",
            subtitle: "Create an account to start annotating",
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  if (!clerkPubKey) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500 text-sm">
        Auth not configured (VITE_CLERK_PUBLISHABLE_KEY missing)
      </div>
    );
  }

  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
