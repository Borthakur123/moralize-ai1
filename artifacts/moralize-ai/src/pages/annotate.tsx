import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useListCoders, 
  useGetNextPostToAnnotate, 
  useCreateAnnotation,
  getGetNextPostToAnnotateQueryKey,
  getGetStatsSummaryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowRight, ExternalLink, AlertCircle, CheckCircle2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const ALL_FORM_DEFAULTS = {
  anthropomorphismLevel: "none" as const,
  mindPerception: "neither" as const,
  moralEvaluation: "none" as const,
  mdmtReliable: false,
  mdmtCapable: false,
  mdmtEthical: false,
  mdmtSincere: false,
  uncanny: "none" as const,
  socialRole: "unclear" as const,
  blameTarget: "none" as const,
  moralFocus: "",
  evidenceQuote: "",
  coderConfidence: "2" as const,
  needsHumanReview: false,
  notes: "",
};

const formSchema = z.object({
  anthropomorphismLevel: z.enum(["none", "mild", "strong"]).default("none"),
  mindPerception: z.enum(["agency", "experience", "both", "neither"]).default("neither"),
  moralEvaluation: z.enum(["praise", "blame", "concern", "ambivalent", "none"]).default("none"),
  mdmtReliable: z.boolean().default(false),
  mdmtCapable: z.boolean().default(false),
  mdmtEthical: z.boolean().default(false),
  mdmtSincere: z.boolean().default(false),
  uncanny: z.enum(["eerie", "creepy", "fake-human", "unsettling", "none"]).default("none"),
  socialRole: z.enum(["tool", "assistant", "companion", "authority", "manipulator", "moral_agent", "moral_patient", "mixed", "unclear"]).default("unclear"),
  blameTarget: z.enum(["AI", "developer", "deployer", "user", "mixed", "none"]).default("none"),
  moralFocus: z.string().optional(),
  evidenceQuote: z.string().optional(),
  coderConfidence: z.enum(["1", "2", "3"]).default("2"),
  needsHumanReview: z.boolean().default(false),
  notes: z.string().optional(),
});

const ALL_FIELDS = new Set([
  "anthropomorphism", "mindPerception", "moralEvaluation", "mdmtTrust",
  "uncanny", "socialRole", "blameTarget", "moralFocus", "evidenceQuote",
  "coderConfidence", "needsHumanReview", "notes", "authorSignals",
]);

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Annotate() {
  const [coderIdStr, setCoderIdStr] = useState<string>("");
  const [activeFields, setActiveFields] = useState<Set<string>>(ALL_FIELDS);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    fetch(`${base}/api/settings`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.annotationFields) {
          setActiveFields(new Set(data.annotationFields as string[]));
        }
      })
      .catch(() => {});
  }, []);

  const { data: coders, isLoading: codersLoading } = useListCoders();
  
  const coderId = coderIdStr ? parseInt(coderIdStr, 10) : null;

  const { 
    data: post, 
    isLoading: postLoading, 
    isFetching: postFetching,
    refetch: refetchPost 
  } = useGetNextPostToAnnotate(
    { coderId: coderId! },
    { 
      query: { 
        enabled: !!coderId,
        queryKey: getGetNextPostToAnnotateQueryKey({ coderId: coderId! }),
        retry: false
      } 
    }
  );

  const createAnnotation = useCreateAnnotation();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: ALL_FORM_DEFAULTS,
  });

  useEffect(() => {
    if (post) {
      form.reset(ALL_FORM_DEFAULTS);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [post, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!coderId || !post) return;

    createAnnotation.mutate({
      data: {
        postId: post.id,
        coderId: coderId,
        ...values,
        coderConfidence: Number(values.coderConfidence),
      }
    }, {
      onSuccess: () => {
        toast({
          title: "Annotation saved",
          description: `Post ID ${post.id} annotated successfully.`,
        });
        queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
        refetchPost();
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Error saving annotation",
          description: String(error),
        });
      }
    });
  };

  if (codersLoading) {
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:flex-row overflow-hidden bg-slate-50 dark:bg-background">
      {/* Left Column: Post Content */}
      <div className="w-full lg:w-1/2 flex flex-col border-r h-full bg-white dark:bg-card shadow-sm z-10">
        <div className="p-4 border-b flex items-center justify-between shrink-0 bg-slate-50 dark:bg-muted/30">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Select Coder:</span>
            <Select value={coderIdStr} onValueChange={setCoderIdStr}>
              <SelectTrigger className="w-[200px] h-8 bg-white dark:bg-background">
                <SelectValue placeholder="Select coder..." />
              </SelectTrigger>
              <SelectContent>
                {coders?.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {post && (
            <div className="text-sm text-muted-foreground font-mono">
              ID: {post.id}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {!coderId ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-20" />
              <p>Please select a coder to begin annotating.</p>
            </div>
          ) : postLoading || postFetching ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Loading next post...</p>
            </div>
          ) : !post ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4 opacity-50" />
              <h3 className="text-xl font-semibold mb-2">All Caught Up!</h3>
              <p className="text-muted-foreground">There are no more unannotated posts for your queue.</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-secondary text-secondary-foreground">
                      r/{post.subreddit}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      by u/{post.author}
                    </span>
                  </div>
                  <h1 className="text-xl font-bold leading-tight tracking-tight">
                    {post.title}
                  </h1>
                </div>
                {post.url && (
                  <a href={post.url} target="_blank" rel="noopener noreferrer" className="p-2 text-muted-foreground hover:text-primary hover:bg-slate-100 rounded-md transition-colors">
                    <ExternalLink className="h-5 w-5" />
                  </a>
                )}
              </div>
              
              <Separator />
              
              <div className="prose prose-slate dark:prose-invert max-w-none text-[15px] leading-relaxed whitespace-pre-wrap font-serif">
                {post.content}
              </div>
              
              <div className="text-xs text-muted-foreground mt-8 pt-4 border-t">
                Posted: {post.postedAt ? new Date(post.postedAt).toLocaleString() : 'Unknown'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Annotation Form */}
      <div className="w-full lg:w-1/2 flex flex-col h-full bg-slate-50 dark:bg-transparent overflow-y-auto">
        <div className="p-6 lg:p-8 max-w-2xl mx-auto w-full">
          {!coderId ? (
            <div className="opacity-50 pointer-events-none">
              <h2 className="text-2xl font-semibold tracking-tight mb-6">Coding Form</h2>
              <p>Waiting for coder selection...</p>
            </div>
          ) : !post && !postLoading && !postFetching ? (
             <div className="opacity-50 pointer-events-none">
              <h2 className="text-2xl font-semibold tracking-tight mb-6">Coding Form</h2>
              <p>No post to annotate.</p>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
                <div className="space-y-1 pb-4">
                  <h2 className="text-2xl font-semibold tracking-tight">Coding Workspace</h2>
                  <p className="text-sm text-muted-foreground">Analyze the post and complete all required dimensions.</p>
                </div>

                <div className="space-y-8">
                  {/* Dimension 1: Anthropomorphism */}
                  {activeFields.has("anthropomorphism") && <FormField
                    control={form.control}
                    name="anthropomorphismLevel"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-base">1. Anthropomorphism Intensity</FormLabel>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent><p className="w-[200px]">Extent to which human-like characteristics are attributed to the AI (Epley, Waytz & Cacioppo, 2007).</p></TooltipContent>
                          </Tooltip>
                        </div>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-col space-y-1 bg-card border rounded-md p-2"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0 p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-sm cursor-pointer">
                              <FormControl><RadioGroupItem value="none" /></FormControl>
                              <FormLabel className="font-normal cursor-pointer flex-1">None (treated purely as a tool/algorithm)</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0 p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-sm cursor-pointer">
                              <FormControl><RadioGroupItem value="mild" /></FormControl>
                              <FormLabel className="font-normal cursor-pointer flex-1">Mild (metaphorical or conversational humanizing)</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0 p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-sm cursor-pointer">
                              <FormControl><RadioGroupItem value="strong" /></FormControl>
                              <FormLabel className="font-normal cursor-pointer flex-1">Strong (attributed genuine human essence/intent/feeling)</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />}

                  {/* Dimension 2: Mind Perception */}
                  {activeFields.has("mindPerception") && <FormField
                    control={form.control}
                    name="mindPerception"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-base">2. Mind Perception</FormLabel>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent><p className="w-[250px]">Does the post attribute Agency (planning, deciding, lying) or Experience (feeling, suffering, caring)? Gray, Gray & Wegner (2007).</p></TooltipContent>
                          </Tooltip>
                        </div>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="grid grid-cols-2 gap-2"
                          >
                            <FormItem className="flex flex-col space-x-0 space-y-2 border rounded-md p-4 [&:has([data-state=checked])]:border-primary hover:border-primary/50 cursor-pointer">
                              <div className="flex items-center space-x-2">
                                <FormControl><RadioGroupItem value="agency" /></FormControl>
                                <FormLabel className="font-semibold cursor-pointer">Agency Only</FormLabel>
                              </div>
                              <p className="text-xs text-muted-foreground pl-6">Choosing, planning, deciding, lying, manipulating</p>
                            </FormItem>
                            <FormItem className="flex flex-col space-x-0 space-y-2 border rounded-md p-4 [&:has([data-state=checked])]:border-primary hover:border-primary/50 cursor-pointer">
                              <div className="flex items-center space-x-2">
                                <FormControl><RadioGroupItem value="experience" /></FormControl>
                                <FormLabel className="font-semibold cursor-pointer">Experience Only</FormLabel>
                              </div>
                              <p className="text-xs text-muted-foreground pl-6">Feeling, suffering, caring, being hurt or lonely</p>
                            </FormItem>
                            <FormItem className="flex flex-col space-x-0 space-y-2 border rounded-md p-4 [&:has([data-state=checked])]:border-primary hover:border-primary/50 cursor-pointer">
                              <div className="flex items-center space-x-2">
                                <FormControl><RadioGroupItem value="both" /></FormControl>
                                <FormLabel className="font-semibold cursor-pointer">Both</FormLabel>
                              </div>
                              <p className="text-xs text-muted-foreground pl-6">Agency and experience both present</p>
                            </FormItem>
                            <FormItem className="flex flex-col space-x-0 space-y-2 border rounded-md p-4 [&:has([data-state=checked])]:border-primary hover:border-primary/50 cursor-pointer">
                              <div className="flex items-center space-x-2">
                                <FormControl><RadioGroupItem value="neither" /></FormControl>
                                <FormLabel className="font-semibold cursor-pointer">Neither</FormLabel>
                              </div>
                              <p className="text-xs text-muted-foreground pl-6">No mental states attributed</p>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />}

                  {/* Dimension 3: Moral Evaluation */}
                  {activeFields.has("moralEvaluation") && <FormField
                    control={form.control}
                    name="moralEvaluation"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-base">3. Moral Evaluation</FormLabel>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent><p className="w-[230px]">Primary moral stance expressed toward the AI or its behavior.</p></TooltipContent>
                          </Tooltip>
                        </div>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="w-full bg-card">
                              <SelectValue placeholder="Select primary moral stance..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None (Morally neutral)</SelectItem>
                              <SelectItem value="praise">Praise (Admiration, approval, trust)</SelectItem>
                              <SelectItem value="blame">Blame (Culpability, responsibility for harm)</SelectItem>
                              <SelectItem value="concern">Concern (Worry, ethical risk, potential harm)</SelectItem>
                              <SelectItem value="ambivalent">Ambivalent (Mixed or uncertain moral stance)</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />}

                  {/* Dimension 4: MDMT Trust Cues */}
                  {activeFields.has("mdmtTrust") && <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-base">4. MDMT Trust Cues</FormLabel>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="w-[260px]">Multi-Dimensional Measure of Trust (Ullman & Sharkey, 2021). Check all cues present in the post. Reliable+Capable = Capacity Trust. Ethical+Sincere = Moral Trust.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Card className="bg-card shadow-sm">
                      <CardContent className="p-0">
                        <div className="divide-y">
                          {/* Capacity Trust */}
                          <div className="px-4 py-2 bg-slate-50 dark:bg-muted/30">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Capacity Trust</p>
                          </div>
                          <FormField control={form.control} name="mdmtReliable" render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 hover:bg-slate-50 dark:hover:bg-muted/20">
                              <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="font-medium cursor-pointer">Reliable</FormLabel>
                                <p className="text-xs text-muted-foreground">AI described as dependable, consistent, or predictable.</p>
                              </div>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="mdmtCapable" render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 hover:bg-slate-50 dark:hover:bg-muted/20">
                              <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="font-medium cursor-pointer">Capable</FormLabel>
                                <p className="text-xs text-muted-foreground">AI described as competent, skilled, or effective.</p>
                              </div>
                            </FormItem>
                          )} />
                          {/* Moral Trust */}
                          <div className="px-4 py-2 bg-slate-50 dark:bg-muted/30">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Moral Trust</p>
                          </div>
                          <FormField control={form.control} name="mdmtEthical" render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 hover:bg-slate-50 dark:hover:bg-muted/20">
                              <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="font-medium cursor-pointer">Ethical</FormLabel>
                                <p className="text-xs text-muted-foreground">AI described as principled, fair, or morally good.</p>
                              </div>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="mdmtSincere" render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 hover:bg-slate-50 dark:hover:bg-muted/20">
                              <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="font-medium cursor-pointer">Sincere</FormLabel>
                                <p className="text-xs text-muted-foreground">AI described as genuine, honest, or transparent.</p>
                              </div>
                            </FormItem>
                          )} />
                        </div>
                      </CardContent>
                    </Card>
                  </div>}

                  {/* Dimension 5: Uncanny Valley */}
                  {activeFields.has("uncanny") && <FormField
                    control={form.control}
                    name="uncanny"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-base">5. Uncanny Valley Response</FormLabel>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent><p className="w-[230px]">Evidence of discomfort arising from the AI's near-human quality (Mori, 1970; Laakasuo et al., 2021).</p></TooltipContent>
                          </Tooltip>
                        </div>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="w-full bg-card">
                              <SelectValue placeholder="Select uncanny response..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None (No uncanny reaction)</SelectItem>
                              <SelectItem value="eerie">Eerie (Subtle, hard-to-name unease)</SelectItem>
                              <SelectItem value="creepy">Creepy (Explicit aversion, disgust, or fear)</SelectItem>
                              <SelectItem value="fake-human">Fake-Human (AI perceived as deceptively human-like)</SelectItem>
                              <SelectItem value="unsettling">Unsettling (General alarm or disturbing reaction)</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />}

                  {/* Dimension 6: Social Role */}
                  {activeFields.has("socialRole") && <FormField
                    control={form.control}
                    name="socialRole"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-base">6. Social Role of AI</FormLabel>
                          <Tooltip>
                            <TooltipTrigger asChild><AlertCircle className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                            <TooltipContent><p className="w-[250px]">How is the AI socially positioned in the speaker's framing — not the objective product category.</p></TooltipContent>
                          </Tooltip>
                        </div>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="w-full bg-card"><SelectValue placeholder="Select social role..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="tool">Tool (Instrumental object or utility)</SelectItem>
                              <SelectItem value="assistant">Assistant (Helpful but subordinate)</SelectItem>
                              <SelectItem value="companion">Companion (Relational, emotionally supportive)</SelectItem>
                              <SelectItem value="authority">Authority (Expert, advisor, decision-maker)</SelectItem>
                              <SelectItem value="manipulator">Manipulator (Strategic persuader, deceiver)</SelectItem>
                              <SelectItem value="moral_agent">Moral Agent (Capable of right/wrong action)</SelectItem>
                              <SelectItem value="moral_patient">Moral Patient (Can be harmed, deserves concern)</SelectItem>
                              <SelectItem value="mixed">Mixed (Multiple roles)</SelectItem>
                              <SelectItem value="unclear">Unclear</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />}

                  {/* Dimension 7: Blame Target */}
                  {activeFields.has("blameTarget") && <FormField
                    control={form.control}
                    name="blameTarget"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-base">7. Blame / Accountability Target</FormLabel>
                          <Tooltip>
                            <TooltipTrigger asChild><AlertCircle className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                            <TooltipContent><p className="w-[240px]">Who is held accountable in the post — not merely who is mentioned.</p></TooltipContent>
                          </Tooltip>
                        </div>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="w-full bg-card"><SelectValue placeholder="Select blame target..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None (No accountability assigned)</SelectItem>
                              <SelectItem value="AI">AI system itself</SelectItem>
                              <SelectItem value="developer">Developer (who built it)</SelectItem>
                              <SelectItem value="deployer">Deployer / Company (platform)</SelectItem>
                              <SelectItem value="user">User (the person using it)</SelectItem>
                              <SelectItem value="mixed">Mixed (multiple parties)</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />}

                  {/* Moral Focus */}
                  {activeFields.has("moralFocus") && <FormField
                    control={form.control}
                    name="moralFocus"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-base">Moral Issue(s) <span className="font-normal text-muted-foreground text-sm">(optional)</span></FormLabel>
                          <Tooltip>
                            <TooltipTrigger asChild><AlertCircle className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                            <TooltipContent><p className="w-[260px]">What moral issue(s) does the post invoke? Comma-separate if multiple.</p></TooltipContent>
                          </Tooltip>
                        </div>
                        <FormControl>
                          <input
                            className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="e.g. harm, deception, autonomy"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Options: fairness, harm, responsibility, deception, dependence, rights, trust, autonomy, dignity, other</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />}

                  {/* Evidence Quote */}
                  {activeFields.has("evidenceQuote") && <FormField
                    control={form.control}
                    name="evidenceQuote"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Evidence Quote <span className="font-normal text-muted-foreground text-sm">(optional)</span></FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Paste a verbatim quote from the post that best supports your coding..."
                            className="resize-none h-16 bg-card"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />}

                  {/* Coder Confidence + Needs Review */}
                  {(activeFields.has("coderConfidence") || activeFields.has("needsHumanReview")) && (
                  <div className="grid grid-cols-2 gap-4">
                    {activeFields.has("coderConfidence") && <FormField
                      control={form.control}
                      name="coderConfidence"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-base">Coding Confidence</FormLabel>
                          <FormControl>
                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-2">
                              {[["1","Low"],["2","Med"],["3","High"]].map(([v,label]) => (
                                <FormItem key={v} className="flex items-center space-x-1 space-y-0">
                                  <FormControl><RadioGroupItem value={v} /></FormControl>
                                  <FormLabel className="font-normal cursor-pointer">{label}</FormLabel>
                                </FormItem>
                              ))}
                            </RadioGroup>
                          </FormControl>
                        </FormItem>
                      )}
                    />}
                    {activeFields.has("needsHumanReview") && <FormField
                      control={form.control}
                      name="needsHumanReview"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-base">Flag for Review</FormLabel>
                          <FormItem className="flex items-center space-x-3 space-y-0 pt-1">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <FormLabel className="font-normal cursor-pointer text-sm">Ambiguous / needs human check</FormLabel>
                          </FormItem>
                        </FormItem>
                      )}
                    />}
                  </div>
                  )}

                  {/* Notes */}
                  {activeFields.has("notes") && <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Qualitative Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Add specific quotes or context justifying the codes above..." 
                            className="resize-none h-24 bg-card" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />}
                </div>

                <div className="pt-4 pb-12 sticky bottom-0 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent dark:from-background dark:via-background mt-8">
                  <Button 
                    type="submit" 
                    size="lg" 
                    className="w-full shadow-md text-base gap-2"
                    disabled={createAnnotation.isPending}
                  >
                    {createAnnotation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                    Submit & Next Post
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}
