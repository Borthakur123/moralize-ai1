import { useState, useRef } from "react";
import { useListPosts, useBulkCreatePosts, getListPostsQueryKey, getGetStatsSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Plus, Upload, Filter, Search, BrainCircuit, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AiStatus = "idle" | "running" | "done" | "error";

interface AiProgressEvent {
  type: "start" | "progress" | "done" | "fatal";
  total?: number;
  completed?: number;
  pct?: number;
  annotated?: number;
  failed?: number;
  message?: string;
  coderId?: number;
}

export default function Posts() {
  const [subreddit, setSubreddit] = useState<string>("all");
  const [annotated, setAnnotated] = useState<string>("all");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importJson, setImportJson] = useState("");

  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiTotal, setAiTotal] = useState(0);
  const [aiCompleted, setAiCompleted] = useState(0);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryParams = {
    ...(subreddit !== "all" && { subreddit }),
    ...(annotated !== "all" && { annotated })
  };

  const { data: posts, isLoading } = useListPosts(queryParams);
  const bulkCreate = useBulkCreatePosts();

  const handleImport = () => {
    try {
      const data = JSON.parse(importJson);
      const postsArray = Array.isArray(data) ? data : [data];
      
      bulkCreate.mutate({
        data: { posts: postsArray }
      }, {
        onSuccess: (res) => {
          toast({
            title: "Import complete",
            description: `Imported ${res.imported} posts. Skipped ${res.skipped} duplicates.`,
          });
          setIsImportOpen(false);
          setImportJson("");
          queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Import failed",
            description: String(err),
          });
        }
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Invalid JSON",
        description: "Please check your format and try again.",
      });
    }
  };

  const runAiAnnotation = async () => {
    setAiStatus("running");
    setAiCompleted(0);
    setAiTotal(0);
    setAiMessage(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const resp = await fetch(`${base}/api/annotations/auto-annotate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal: ctrl.signal,
      });

      if (!resp.ok) throw new Error(`Server error ${resp.status}`);

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as AiProgressEvent;
            if (event.type === "start") {
              setAiTotal(event.total ?? 0);
            } else if (event.type === "progress") {
              setAiCompleted(event.completed ?? 0);
              setAiTotal(event.total ?? aiTotal);
            } else if (event.type === "done") {
              setAiStatus("done");
              const msg = event.annotated === 0
                ? (event.message ?? "All posts already annotated.")
                : `Annotated ${event.annotated} of ${event.total} posts${event.failed ? ` (${event.failed} failed)` : ""}.`;
              setAiMessage(msg);
              queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
              queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
            } else if (event.type === "fatal") {
              setAiStatus("error");
              setAiMessage(event.message ?? "Unknown error.");
            }
          } catch {
            // skip malformed event
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setAiStatus("error");
        setAiMessage(String(err));
      }
    }
  };

  const cancelAiAnnotation = () => {
    abortRef.current?.abort();
    setAiStatus("idle");
    setAiMessage(null);
  };

  const pct = aiTotal > 0 ? Math.round((aiCompleted / aiTotal) * 100) : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Post Corpus</h1>
          <p className="text-muted-foreground mt-1">Manage the dataset of Reddit posts for annotation.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* AI Auto-Annotate */}
          <Dialog open={isAiOpen} onOpenChange={(open) => {
            if (!open && aiStatus === "running") return;
            setIsAiOpen(open);
            if (!open) { setAiStatus("idle"); setAiMessage(null); }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
                <BrainCircuit className="h-4 w-4" />
                AI Auto-Annotate
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-violet-500" />
                  AI Auto-Annotate
                </DialogTitle>
                <DialogDescription>
                  GPT will read each unannotated post and code all six dimensions automatically.
                  Results are saved under an <strong>AI Annotator</strong> coder so you can compare
                  AI vs. human coding and run agreement analysis.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4 space-y-5">
                {aiStatus === "idle" && (
                  <div className="rounded-lg border bg-muted/40 p-4 space-y-3 text-sm text-muted-foreground">
                    <p>The model will annotate:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Anthropomorphism Level (none / mild / strong)</li>
                      <li>Mind Perception (agency / experience / both / neither)</li>
                      <li>Moral Evaluation (praise / blame / concern / ambivalent / none)</li>
                      <li>VASS Cues (values, autonomy, social connection, self-aware emotions)</li>
                      <li>Uncanny Marker (eerie / creepy / fake-human / unsettling / none)</li>
                    </ul>
                    <p className="text-xs pt-1">Only unannotated posts will be processed. Previously annotated posts are skipped.</p>
                  </div>
                )}

                {aiStatus === "running" && (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Annotating…
                      </span>
                      <span className="font-medium">{aiCompleted} / {aiTotal}</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <p className="text-xs text-center text-muted-foreground">{pct}% complete</p>
                  </div>
                )}

                {aiStatus === "done" && (
                  <div className="flex flex-col items-center gap-3 py-2">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                    <p className="text-sm font-medium text-center">{aiMessage}</p>
                    <Progress value={100} className="h-2 w-full" />
                  </div>
                )}

                {aiStatus === "error" && (
                  <div className="flex flex-col items-center gap-3 py-2">
                    <XCircle className="h-10 w-10 text-red-500" />
                    <p className="text-sm text-center text-red-600">{aiMessage}</p>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  {aiStatus === "idle" && (
                    <>
                      <Button variant="outline" onClick={() => setIsAiOpen(false)}>Cancel</Button>
                      <Button className="bg-violet-600 hover:bg-violet-700 text-white gap-2" onClick={runAiAnnotation}>
                        <BrainCircuit className="h-4 w-4" />
                        Run AI Annotation
                      </Button>
                    </>
                  )}
                  {aiStatus === "running" && (
                    <Button variant="destructive" onClick={cancelAiAnnotation}>Stop</Button>
                  )}
                  {(aiStatus === "done" || aiStatus === "error") && (
                    <Button onClick={() => { setIsAiOpen(false); setAiStatus("idle"); setAiMessage(null); }}>
                      Close
                    </Button>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Bulk Import */}
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Bulk Import
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Import Posts JSON</DialogTitle>
                <DialogDescription>
                  Paste an array of post objects from your Reddit scraper.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="rounded-md bg-muted p-3 font-mono text-[10px] text-muted-foreground">
                  {`[
  {
    "platform": "reddit",
    "subreddit": "ChatGPT",
    "author": "user123",
    "title": "It feels like it understands me",
    "content": "...",
    "url": "https://..."
  }
]`}
                </div>
                <Textarea
                  placeholder="Paste JSON here..."
                  className="font-mono h-[300px]"
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsImportOpen(false)}>Cancel</Button>
                <Button onClick={handleImport} disabled={!importJson.trim() || bulkCreate.isPending}>
                  {bulkCreate.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Import Data
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-lg border shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mr-2">
          <Filter className="h-4 w-4" />
          Filters:
        </div>
        <div className="flex items-center gap-2">
          <Select value={annotated} onValueChange={setAnnotated}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="yes">Annotated</SelectItem>
              <SelectItem value="no">Unannotated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 w-full relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Filter by subreddit (e.g. ChatGPT)..." 
            className="pl-9"
            value={subreddit === "all" ? "" : subreddit}
            onChange={(e) => setSubreddit(e.target.value || "all")}
          />
        </div>
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">ID</TableHead>
              <TableHead className="w-[150px]">Subreddit</TableHead>
              <TableHead>Content Snippet</TableHead>
              <TableHead className="w-[100px] text-center">Codes</TableHead>
              <TableHead className="w-[150px] text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : posts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No posts found matching filters.
                </TableCell>
              </TableRow>
            ) : (
              posts?.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{post.id}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal bg-slate-100 dark:bg-slate-800">
                      r/{post.subreddit}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[400px]">
                    <div className="font-medium truncate">{post.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{post.content}</div>
                  </TableCell>
                  <TableCell className="text-center">
                    {post.annotationCount > 0 ? (
                      <Badge variant="default" className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border-emerald-200">
                        {post.annotationCount}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {format(new Date(post.createdAt), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
