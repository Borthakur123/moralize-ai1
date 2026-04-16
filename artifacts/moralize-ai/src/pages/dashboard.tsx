import { useGetStatsSummary, useGetStatsBySubreddit, getGetStatsSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  BarChart as BarChartIcon, 
  Database, 
  Users, 
  PenTool,
  CheckCircle2
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Dashboard() {
  const { data: stats, isLoading } = useGetStatsSummary();
  const { data: subreddits } = useGetStatsBySubreddit();

  if (isLoading) {
    return <div className="p-8 space-y-4">
      <div className="h-8 w-64 bg-muted animate-pulse rounded"></div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl"></div>)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-80 bg-muted animate-pulse rounded-xl"></div>
        <div className="h-80 bg-muted animate-pulse rounded-xl"></div>
      </div>
    </div>;
  }

  if (!stats) return <div className="p-8">No data available</div>;

  const coveragePct = stats.totalPosts > 0 
    ? Math.round((stats.annotatedPosts / stats.totalPosts) * 100) 
    : 0;

  const anthroData = [
    { name: 'None', value: stats.anthropomorphismBreakdown.none },
    { name: 'Mild', value: stats.anthropomorphismBreakdown.mild },
    { name: 'Strong', value: stats.anthropomorphismBreakdown.strong },
  ].filter(d => d.value > 0);

  const moralData = [
    { name: 'Praise', value: stats.moralEvaluationBreakdown.praise },
    { name: 'Blame', value: stats.moralEvaluationBreakdown.blame },
    { name: 'Concern', value: stats.moralEvaluationBreakdown.concern },
    { name: 'Ambivalent', value: stats.moralEvaluationBreakdown.ambivalent },
    { name: 'None', value: stats.moralEvaluationBreakdown.none },
  ];

  const mindData = [
    { name: 'Agency', value: stats.mindPerceptionBreakdown.agency },
    { name: 'Experience', value: stats.mindPerceptionBreakdown.experience },
    { name: 'Both', value: stats.mindPerceptionBreakdown.both },
    { name: 'Neither', value: stats.mindPerceptionBreakdown.neither },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Corpus Overview</h1>
          <p className="text-muted-foreground mt-1">
            Status and distribution metrics for the AI moral evaluation study.
          </p>
        </div>
        <Link href="/annotate" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-6 py-2 gap-2">
          <PenTool className="h-4 w-4" />
          Jump to Workspace
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPosts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.unannotatedPosts.toLocaleString()} awaiting coding
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coverage</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coveragePct}%</div>
            <div className="w-full bg-secondary h-2 mt-3 rounded-full overflow-hidden">
              <div 
                className="bg-primary h-full" 
                style={{ width: `${coveragePct}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Annotations</CardTitle>
            <BarChartIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAnnotations.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all coders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Coders</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCoders}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Registered annotators
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Anthropomorphism</CardTitle>
            <CardDescription>Distribution of attribution intensity</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {anthroData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={anthroData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {anthroData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Moral Evaluation</CardTitle>
            <CardDescription>Count by sentiment category</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moralData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
