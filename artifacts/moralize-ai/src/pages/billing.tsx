import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Zap, Package, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

const PACK_ICONS = [Package, Zap, Star];

interface Pack {
  product_id: string;
  name: string;
  description: string;
  price_id: string;
  unit_amount: number;
  currency: string;
  metadata?: Record<string, string>;
}

interface Usage {
  current: number;
  limit: number | null;
  free: number;
}

export default function BillingPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const { data: usage } = useQuery<Usage>({
    queryKey: ["posts-usage"],
    queryFn: () => fetch(`${base}/api/posts/usage`).then((r) => r.json()),
  });

  const { data: packsData } = useQuery<{ packs: Pack[]; publishableKey: string }>({
    queryKey: ["stripe-packs"],
    queryFn: () => fetch(`${base}/api/stripe/packs`).then((r) => r.json()),
  });

  const packs = packsData?.packs ?? [];
  const current = usage?.current ?? 0;
  const limit = usage?.limit ?? 500;
  const progressPct = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const isNearLimit = progressPct >= 80;

  async function handleBuy(pack: Pack) {
    const postCount = parseInt(pack.metadata?.postCount ?? "0", 10);
    if (!postCount || !pack.price_id) {
      toast({ title: "Error", description: "Invalid pack configuration.", variant: "destructive" });
      return;
    }
    setLoading(pack.price_id);
    try {
      const resp = await fetch(`${base}/api/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: pack.price_id, postCount }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
      setLoading(null);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Billing & Credits</h1>
        <p className="text-slate-500 mt-1">Buy post credits to expand your research corpus.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Post Usage</CardTitle>
          <CardDescription>
            {usage
              ? `${current.toLocaleString()} of ${limit.toLocaleString()} post slots used`
              : "Loading..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress
            value={progressPct}
            className={`h-2 ${isNearLimit ? "[&>div]:bg-amber-500" : ""}`}
          />
          {isNearLimit && (
            <p className="text-sm text-amber-600 font-medium">
              You are approaching your post limit. Purchase credits below to continue importing posts.
            </p>
          )}
          <div className="flex gap-4 text-sm text-slate-500">
            <span>Free tier: {(usage?.free ?? 500).toLocaleString()} posts</span>
            {limit > (usage?.free ?? 500) && (
              <span>Purchased: +{(limit - (usage?.free ?? 500)).toLocaleString()} posts</span>
            )}
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Buy More Post Credits</h2>
        {packs.length === 0 ? (
          <p className="text-slate-400 text-sm">Loading credit packs...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {packs.map((pack, i) => {
              const Icon = PACK_ICONS[i % PACK_ICONS.length];
              const postCount = parseInt(pack.metadata?.postCount ?? "0", 10);
              const priceUsd = (pack.unit_amount / 100).toFixed(2);
              const isPopular = i === 1;
              return (
                <Card
                  key={pack.price_id}
                  className={`relative flex flex-col ${isPopular ? "border-indigo-500 shadow-md" : ""}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs px-3 py-0.5 rounded-full font-medium">
                      Most Popular
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${isPopular ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-600"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{pack.name}</CardTitle>
                    <CardDescription className="text-xs">{pack.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="text-2xl font-bold text-slate-900">
                      ${priceUsd}
                    </div>
                    <div className="text-sm text-slate-500">
                      {postCount.toLocaleString()} posts — one-time
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className={`w-full ${isPopular ? "bg-indigo-500 hover:bg-indigo-600" : ""}`}
                      variant={isPopular ? "default" : "outline"}
                      disabled={loading === pack.price_id}
                      onClick={() => handleBuy(pack)}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      {loading === pack.price_id ? "Redirecting..." : "Buy Now"}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 text-center">
        Payments are processed securely by Stripe. Credits are added instantly after purchase and never expire.
      </p>
    </div>
  );
}
