import { useGetAgreementStats } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Agreement() {
  const { data: stats, isLoading } = useGetAgreementStats();

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!stats) {
    return <div className="p-8">Failed to load agreement stats.</div>;
  }

  const getStatusColor = (pct: number) => {
    if (pct >= 80) return "text-emerald-500";
    if (pct >= 65) return "text-amber-500";
    return "text-destructive";
  };

  const getStatusBg = (pct: number) => {
    if (pct >= 80) return "bg-emerald-500";
    if (pct >= 65) return "bg-amber-500";
    return "bg-destructive";
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inter-Rater Reliability</h1>
        <p className="text-muted-foreground mt-1">
          Exact match agreement percentage for posts coded by multiple annotators.
        </p>
      </div>

      {stats.postsWithMultipleAnnotations === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Not enough data</AlertTitle>
          <AlertDescription>
            No posts have been coded by more than one annotator yet. Agreement statistics will appear here once overlaps exist.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="bg-muted/50 p-4 rounded-lg border flex items-center justify-between">
            <span className="font-medium text-sm">Overlapping Posts</span>
            <span className="text-xl font-bold font-mono">{stats.postsWithMultipleAnnotations}</span>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {[
              { title: "Anthropomorphism Level", pct: stats.anthropomorphismAgreementPct, desc: "Exact match on none/mild/strong" },
              { title: "Mind Perception", pct: stats.mindPerceptionAgreementPct, desc: "Exact match on agency/experience/both/neither" },
              { title: "Moral Evaluation", pct: stats.moralEvaluationAgreementPct, desc: "Exact match on praise/blame/concern/ambivalent/none" },
              { title: "Uncanny Valley", pct: stats.uncannyAgreementPct, desc: "Exact match on uncanny categorization" },
            ].map((item) => (
              <Card key={item.title} className="overflow-hidden">
                <div className={`h-2 w-full ${getStatusBg(item.pct)}`} />
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription>{item.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2 mt-4">
                    <span className={`text-4xl font-bold tracking-tighter ${getStatusColor(item.pct)}`}>
                      {item.pct.toFixed(1)}%
                    </span>
                    <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                      Agreement
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <p className="text-sm text-muted-foreground text-center">
            Scores above 80% generally indicate strong reliability for academic publication.
          </p>
        </>
      )}
    </div>
  );
}
