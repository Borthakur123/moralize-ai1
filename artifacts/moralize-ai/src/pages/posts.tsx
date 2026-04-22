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
import { Loader2, Plus, Upload, Filter, Search, BrainCircuit, CheckCircle2, XCircle, AlertCircle, Trash2, RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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

  const [isRedditOpen, setIsRedditOpen] = useState(false);
  const [redditSubreddit, setRedditSubreddit] = useState("ChatGPT");
  const [redditLimit, setRedditLimit] = useState("100");
  const [redditQuery, setRedditQuery] = useState("");
  const [isFetchingReddit, setIsFetchingReddit] = useState(false);

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

  const { data: posts, isLoading } = useListPosts({ ...queryParams, limit: 500 });
  const bulkCreate = useBulkCreatePosts();

  // Normalize a single raw Reddit post object into our schema
  const normalizeRedditPost = (p: Record<string, unknown>) => {
    // Already in our format
    if (typeof p.content === "string") return p;

    const selftextRaw = p.selftext ?? p.body;
    const selftext = typeof selftextRaw === "string" ? selftextRaw : "";
    const title = (p.title ?? "") as string;
    const author = (p.author ?? p.author_fullname ?? "") as string;
    const subreddit = (p.subreddit ?? p.subreddit_name_prefixed?.toString().replace(/^r\//, "") ?? "") as string;
    const permalink = p.permalink as string | undefined;
    const rawUrl = p.url as string | undefined;
    const url = permalink
      ? `https://www.reddit.com${permalink}`
      : rawUrl ?? "";
    const createdUtc = p.created_utc as number | undefined;
    // Reddit / PullPush post ID (e.g. "1spg0eu") — used to deduplicate on re-import
    const redditId = (p.id ?? p.name?.toString().replace(/^t3_/, "")) as string | undefined;
    const externalId = redditId ? `reddit:${redditId}` : undefined;

    const contentText = selftext.trim() || title.toString().trim();

    return {
      platform: "reddit",
      subreddit: subreddit.toString(),
      author: author.toString(),
      title: title.toString(),
      content: contentText,
      url,
      ...(externalId ? { externalId } : {}),
      ...(createdUtc ? { postedAt: new Date(createdUtc * 1000).toISOString() } : {}),
      _empty: !contentText,
    };
  };

  // Extract posts from any Reddit JSON shape
  const extractPosts = (raw: unknown): Record<string, unknown>[] => {
    if (Array.isArray(raw)) {
      // Could be array of Reddit post objects or array of Listing responses
      return raw.flatMap((item) => {
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          // Reddit Listing wrapper
          if (obj.kind === "Listing" && obj.data) {
            const listing = obj.data as Record<string, unknown>;
            const children = listing.children as { kind: string; data: Record<string, unknown> }[] ?? [];
            return children.filter(c => c.kind === "t3").map(c => normalizeRedditPost(c.data));
          }
          // Nested { kind: "t3", data: {...} }
          if (obj.kind === "t3" && obj.data) {
            return [normalizeRedditPost(obj.data as Record<string, unknown>)];
          }
          // Plain post object (may have selftext or content)
          return [normalizeRedditPost(obj)];
        }
        return [];
      });
    }
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      // Single Reddit Listing: { kind: "Listing", data: { children: [...] } }
      if (obj.kind === "Listing" && obj.data) {
        const listing = obj.data as Record<string, unknown>;
        const children = (listing.children as { kind: string; data: Record<string, unknown> }[]) ?? [];
        return children.filter(c => c.kind === "t3").map(c => normalizeRedditPost(c.data));
      }
      // Reddit .json response: { data: { children: [...] } }
      if (obj.data && typeof obj.data === "object") {
        const inner = obj.data as Record<string, unknown>;
        if (Array.isArray(inner.children)) {
          return (inner.children as { kind: string; data: Record<string, unknown> }[])
            .filter(c => c.kind === "t3")
            .map(c => normalizeRedditPost(c.data));
        }
      }
      // Single post object
      return [normalizeRedditPost(obj)];
    }
    return [];
  };

  const handleImport = () => {
    try {
      const raw = JSON.parse(importJson);
      const postsArray = extractPosts(raw);

      if (postsArray.length === 0) {
        toast({ variant: "destructive", title: "No posts found", description: "Could not find any posts in the JSON. Check the format." });
        return;
      }

      // Filter out link/image posts with no text content
      const emptyCount = postsArray.filter(p => p._empty).length;
      const validPosts = postsArray
        .filter(p => !p._empty)
        .map(({ _empty, ...rest }) => rest);

      if (validPosts.length === 0) {
        toast({ variant: "destructive", title: "No text posts found", description: `All ${emptyCount} posts were link/image posts with no body text.` });
        return;
      }

      bulkCreate.mutate({
        data: { posts: validPosts }
      }, {
        onSuccess: (res) => {
          const skippedMsg = [
            res.skipped > 0 ? `${res.skipped} duplicate${res.skipped > 1 ? "s" : ""} skipped` : null,
            emptyCount > 0 ? `${emptyCount} link/image posts skipped` : null,
          ].filter(Boolean).join(", ");
          toast({
            title: "Import complete",
            description: `Imported ${res.imported} posts.${skippedMsg ? ` (${skippedMsg})` : ""}`,
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

  const handleFetchReddit = async () => {
    setIsFetchingReddit(true);
    try {
      const sub = redditSubreddit.trim();
      const maxPosts = Math.min(Number(redditLimit) || 100, 500);

      const resp = await fetch("/api/posts/fetch-reddit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subreddit: sub, limit: maxPosts, searchQuery: redditQuery.trim() || undefined }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({})) as { error?: string };
        toast({ variant: "destructive", title: "Fetch failed", description: err.error ?? `Server error ${resp.status}` });
        return;
      }
      const { posts: allRaw, fetchedAfter } = await resp.json() as { posts: Record<string, unknown>[]; fetchedAfter: string | null };

      if (allRaw.length === 0) {
        const sinceMsg = fetchedAfter ? ` since ${new Date(fetchedAfter).toLocaleDateString()}` : "";
        toast({ title: "No new posts", description: `No new posts found in r/${sub}${sinceMsg}. The subreddit has no new activity since your last import.` });
        return;
      }

      const postsArray = allRaw.map(normalizeRedditPost);
      const emptyCount = postsArray.filter(p => p._empty).length;
      const validPosts = postsArray.filter(p => !p._empty).map(({ _empty, ...rest }) => rest);

      if (validPosts.length === 0) {
        toast({ variant: "destructive", title: "No text posts found", description: `All ${emptyCount} posts were link/image posts with no body text.` });
        return;
      }

      bulkCreate.mutate({ data: { posts: validPosts } }, {
        onSuccess: (res) => {
          const sinceMsg = fetchedAfter ? ` after ${new Date(fetchedAfter).toLocaleDateString()}` : "";
          const skippedMsg = [
            res.skipped > 0 ? `${res.skipped} duplicate${res.skipped > 1 ? "s" : ""} skipped` : null,
            emptyCount > 0 ? `${emptyCount} link/image posts skipped` : null,
          ].filter(Boolean).join(", ");
          toast({
            title: "Import complete",
            description: `Imported ${res.imported} new posts from r/${sub}${sinceMsg}.${skippedMsg ? ` (${skippedMsg})` : ""}`,
          });
          setIsRedditOpen(false);
          queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Import failed", description: String(err) });
        },
      });
    } catch (err) {
      toast({ variant: "destructive", title: "Fetch failed", description: String(err) });
    } finally {
      setIsFetchingReddit(false);
    }
  };

  const [isClearing, setIsClearing] = useState(false);

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      const res = await fetch("/api/posts/all", { method: "DELETE" });
      if (!res.ok) throw new Error("Request failed");
      toast({ title: "Data cleared", description: "All posts and annotations have been deleted." });
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to clear data." });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Post Corpus</h1>
          <p className="text-muted-foreground mt-1">Manage the dataset of Reddit posts for annotation.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Clear All Data */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-destructive text-destructive hover:bg-destructive hover:text-white">
                <Trash2 className="h-4 w-4" />
                Clear All Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete <strong>all posts and all annotations</strong> from the database. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={handleClearAll}
                  disabled={isClearing}
                >
                  {isClearing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Yes, delete everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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
                      <li>MDMT Trust Cues (reliable / capable / ethical / sincere)</li>
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

          {/* Fetch from Reddit */}
          <Dialog open={isRedditOpen} onOpenChange={setIsRedditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Fetch from Reddit
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-orange-500" />
                  Fetch from Reddit
                </DialogTitle>
                <DialogDescription>
                  Pull posts directly from any public subreddit. The app handles pagination automatically.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Subreddit</label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">r/</span>
                    <Input
                      placeholder="ChatGPT"
                      value={redditSubreddit}
                      onChange={e => setRedditSubreddit(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Keyword search <span className="font-normal text-muted-foreground">(optional)</span></label>
                  <Input
                    placeholder='e.g. "feels like talking to a person"'
                    value={redditQuery}
                    onChange={e => setRedditQuery(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Leave blank to get the newest posts. Add a keyword to search within the subreddit.</p>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Max posts to fetch</label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={redditLimit}
                    onChange={e => setRedditLimit(e.target.value)}
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">Up to 500. Link/image posts with no text will be skipped automatically.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsRedditOpen(false)} disabled={isFetchingReddit}>Cancel</Button>
                <Button
                  onClick={handleFetchReddit}
                  disabled={!redditSubreddit.trim() || isFetchingReddit || bulkCreate.isPending}
                  className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {isFetchingReddit || bulkCreate.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <RefreshCw className="h-4 w-4" />}
                  {isFetchingReddit ? "Fetching…" : bulkCreate.isPending ? "Importing…" : "Fetch & Import"}
                </Button>
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
                  Paste JSON from Reddit. Raw Reddit API format is auto-detected and converted — no reformatting needed.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="rounded-md bg-muted p-3 text-[11px] text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Accepted formats:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Raw Reddit <code className="bg-muted-foreground/20 px-1 rounded">.json</code> URL response <span className="opacity-70">(reddit.com/r/…/.json)</span></li>
                    <li>PRAW / pushshift array with <code className="bg-muted-foreground/20 px-1 rounded">selftext</code> field</li>
                    <li>Pre-formatted array with <code className="bg-muted-foreground/20 px-1 rounded">content</code> field</li>
                  </ul>
                  <p className="opacity-60 text-[10px] pt-1">Link/image posts with no body text are skipped automatically.</p>
                </div>
                <Textarea
                  placeholder="Paste JSON here…"
                  className="font-mono h-[280px]"
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
