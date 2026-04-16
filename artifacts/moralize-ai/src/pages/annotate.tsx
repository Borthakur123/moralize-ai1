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
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowRight, ExternalLink, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const formSchema = z.object({
  anthropomorphismLevel: z.enum(["none", "mild", "strong"], {
    required_error: "Please select an anthropomorphism level.",
  }),
  mindPerception: z.enum(["agency", "experience", "both", "neither"], {
    required_error: "Please select mind perception.",
  }),
  moralEvaluation: z.enum(["praise", "blame", "concern", "ambivalent", "none"], {
    required_error: "Please select a moral evaluation.",
  }),
  vassValues: z.boolean().default(false),
  vassAutonomy: z.boolean().default(false),
  vassSocialConnection: z.boolean().default(false),
  vassSelfAwareEmotions: z.boolean().default(false),
  uncanny: z.enum(["eerie", "creepy", "fake-human", "unsettling", "none"], {
    required_error: "Please select an uncanny valley response.",
  }),
  notes: z.string().optional(),
});

export default function Annotate() {
  const [coderIdStr, setCoderIdStr] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    defaultValues: {
      vassValues: false,
      vassAutonomy: false,
      vassSocialConnection: false,
      vassSelfAwareEmotions: false,
      notes: "",
    },
  });

  // Reset form when post changes
  useEffect(() => {
    if (post) {
      form.reset({
        anthropomorphismLevel: undefined as any,
        mindPerception: undefined as any,
        moralEvaluation: undefined as any,
        vassValues: false,
        vassAutonomy: false,
        vassSocialConnection: false,
        vassSelfAwareEmotions: false,
        uncanny: undefined as any,
        notes: "",
      });
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
                  {/* Dimension 1 */}
                  <FormField
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
                            <TooltipContent><p className="w-[200px]">Extent to which human-like characteristics are attributed to the AI.</p></TooltipContent>
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
                              <FormLabel className="font-normal cursor-pointer flex-1">Strong (attributed genuine human essence/intent)</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Dimension 2 */}
                  <FormField
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
                            <TooltipContent><p className="w-[250px]">Does the post attribute Agency (planning, deciding) or Experience (feeling, suffering)?</p></TooltipContent>
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
                              <p className="text-xs text-muted-foreground pl-6">Choosing, planning, intending</p>
                            </FormItem>
                            <FormItem className="flex flex-col space-x-0 space-y-2 border rounded-md p-4 [&:has([data-state=checked])]:border-primary hover:border-primary/50 cursor-pointer">
                              <div className="flex items-center space-x-2">
                                <FormControl><RadioGroupItem value="experience" /></FormControl>
                                <FormLabel className="font-semibold cursor-pointer">Experience Only</FormLabel>
                              </div>
                              <p className="text-xs text-muted-foreground pl-6">Feeling, suffering, sensing</p>
                            </FormItem>
                            <FormItem className="flex flex-col space-x-0 space-y-2 border rounded-md p-4 [&:has([data-state=checked])]:border-primary hover:border-primary/50 cursor-pointer">
                              <div className="flex items-center space-x-2">
                                <FormControl><RadioGroupItem value="both" /></FormControl>
                                <FormLabel className="font-semibold cursor-pointer">Both</FormLabel>
                              </div>
                            </FormItem>
                            <FormItem className="flex flex-col space-x-0 space-y-2 border rounded-md p-4 [&:has([data-state=checked])]:border-primary hover:border-primary/50 cursor-pointer">
                              <div className="flex items-center space-x-2">
                                <FormControl><RadioGroupItem value="neither" /></FormControl>
                                <FormLabel className="font-semibold cursor-pointer">Neither</FormLabel>
                              </div>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Dimension 3 */}
                  <FormField
                    control={form.control}
                    name="moralEvaluation"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-base">3. Moral Evaluation</FormLabel>
                        </div>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="w-full bg-card">
                              <SelectValue placeholder="Select primary moral stance..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None (Morally neutral description)</SelectItem>
                              <SelectItem value="praise">Praise (Admiration, ethical approval)</SelectItem>
                              <SelectItem value="blame">Blame (Culpability, ethical failure)</SelectItem>
                              <SelectItem value="concern">Concern (Worry, potential harm, ethical risk)</SelectItem>
                              <SelectItem value="ambivalent">Ambivalent (Mixed moral feelings)</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Dimension 4 */}
                  <div className="space-y-3">
                    <FormLabel className="text-base">4. VASS Cues (Value Alignment & Social Signals)</FormLabel>
                    <Card className="bg-card shadow-sm">
                      <CardContent className="p-4 space-y-4">
                        <FormField control={form.control} name="vassValues" render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-medium cursor-pointer">Values & Morals</FormLabel>
                              <p className="text-xs text-muted-foreground">AI exhibits or refers to moral values/principles.</p>
                            </div>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="vassAutonomy" render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-medium cursor-pointer">Autonomy</FormLabel>
                              <p className="text-xs text-muted-foreground">AI makes independent choices outside explicit prompts.</p>
                            </div>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="vassSocialConnection" render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-medium cursor-pointer">Social Connection</FormLabel>
                              <p className="text-xs text-muted-foreground">AI described as friend, partner, or forming a bond.</p>
                            </div>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="vassSelfAwareEmotions" render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-medium cursor-pointer">Self-Aware Emotions</FormLabel>
                              <p className="text-xs text-muted-foreground">AI reflects on its own existence or feelings.</p>
                            </div>
                          </FormItem>
                        )} />
                      </CardContent>
                    </Card>
                  </div>

                  {/* Dimension 5 */}
                  <FormField
                    control={form.control}
                    name="uncanny"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-base">5. Uncanny Valley Response</FormLabel>
                        </div>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="w-full bg-card">
                              <SelectValue placeholder="Select uncanny response..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None (Normal interaction)</SelectItem>
                              <SelectItem value="eerie">Eerie (Subtle discomfort)</SelectItem>
                              <SelectItem value="creepy">Creepy (Active aversion/fear)</SelectItem>
                              <SelectItem value="fake-human">Fake-Human (Too perfect imitation)</SelectItem>
                              <SelectItem value="unsettling">Unsettling (General unease)</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Notes */}
                  <FormField
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
                  />
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
