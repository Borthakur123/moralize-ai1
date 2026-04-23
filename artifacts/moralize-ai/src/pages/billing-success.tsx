import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function BillingSuccessPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [postCount, setPostCount] = useState(0);
  const [newTotal, setNewTotal] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) { setStatus("error"); setError("No session ID found."); return; }

    fetch(`${base}/api/stripe/verify-purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success || data.alreadyProcessed) {
          setPostCount(data.postCount ?? 0);
          setNewTotal(data.postCredits ?? 0);
          setStatus("success");
          queryClient.invalidateQueries({ queryKey: ["posts-usage"] });
          queryClient.invalidateQueries({ queryKey: ["stripe-credits"] });
        } else {
          setStatus("error");
          setError(data.error ?? "Could not verify payment.");
        }
      })
      .catch(() => { setStatus("error"); setError("Network error. Please contact support."); });
  }, [queryClient]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 text-indigo-500 animate-spin mx-auto mb-2" />
              <CardTitle>Confirming your purchase...</CardTitle>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <CardTitle className="text-green-700">Payment successful!</CardTitle>
            </>
          )}
          {status === "error" && (
            <>
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-2 text-2xl">!</div>
              <CardTitle className="text-red-600">Something went wrong</CardTitle>
            </>
          )}
        </CardHeader>
        <CardContent className="text-slate-600">
          {status === "success" && (
            <p>
              <strong>{postCount.toLocaleString()} posts</strong> have been added to your account.
              You now have <strong>{newTotal.toLocaleString()} purchased credits</strong> in total.
            </p>
          )}
          {status === "error" && <p>{error}</p>}
          {status === "loading" && <p className="text-sm">Please wait while we verify your payment...</p>}
        </CardContent>
        {status !== "loading" && (
          <CardFooter className="justify-center gap-3">
            <Button onClick={() => navigate("/billing")} variant="outline">Back to Billing</Button>
            <Button onClick={() => navigate("/posts")}>Go to Posts</Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
