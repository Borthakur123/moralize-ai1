import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Save, RotateCcw } from "lucide-react";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

const FIELD_GROUPS = [
  {
    id: "anthropomorphism",
    label: "Anthropomorphism Level",
    description: "How much the author humanises the AI (none / mild / strong)",
  },
  {
    id: "mindPerception",
    label: "Mind Perception",
    description: "Whether the AI is framed as having agency, experience, both, or neither",
  },
  {
    id: "moralEvaluation",
    label: "Moral Evaluation",
    description: "Overall moral stance — praise, blame, concern, ambivalent, or none",
  },
  {
    id: "mdmtTrust",
    label: "MDMT Trust Cues",
    description: "Four trust dimensions: reliable, capable, ethical, sincere",
  },
  {
    id: "uncanny",
    label: "Uncanny Valley",
    description: "Discomfort reactions — eerie, creepy, fake-human, unsettling, or none",
  },
  {
    id: "socialRole",
    label: "Social Role",
    description: "How the AI is positioned: tool, assistant, companion, authority, etc.",
  },
  {
    id: "blameTarget",
    label: "Blame Target",
    description: "Who is held accountable — AI, developer, deployer, user, mixed, or none",
  },
  {
    id: "moralFocus",
    label: "Moral Focus",
    description: "Type of moral issue: harm, fairness, responsibility, deception, etc.",
  },
  {
    id: "evidenceQuote",
    label: "Evidence Quote",
    description: "Verbatim span from the text that best supports the main coding",
  },
  {
    id: "coderConfidence",
    label: "Coder Confidence",
    description: "How confident the annotator is in the coding (1 low – 3 high)",
  },
  {
    id: "needsHumanReview",
    label: "Needs Human Review",
    description: "Flag sarcastic, ambiguous, or contradictory posts for manual check",
  },
  {
    id: "notes",
    label: "Notes",
    description: "Free-text reasoning summary from the annotator",
  },
  {
    id: "authorSignals",
    label: "Author Signals",
    description: "Inferred author traits: openness, ideology, expertise, affect, agreeableness, neuroticism",
  },
] as const;

type FieldId = typeof FIELD_GROUPS[number]["id"];

const DEFAULT_FIELDS: FieldId[] = FIELD_GROUPS.map((f) => f.id);

export default function Settings() {
  const { toast } = useToast();
  const [selectedFields, setSelectedFields] = useState<Set<FieldId>>(new Set(DEFAULT_FIELDS));
  const [customPrompt, setCustomPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const resp = await fetch(`${base}/api/settings`);
        if (!resp.ok) throw new Error("Failed to load settings");
        const data = await resp.json() as { annotationFields: string[]; customPrompt: string | null };
        setSelectedFields(new Set(data.annotationFields as FieldId[]));
        setCustomPrompt(data.customPrompt ?? "");
      } catch {
        toast({ title: "Could not load settings", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const toggle = (id: FieldId) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetToDefault = () => {
    setSelectedFields(new Set(DEFAULT_FIELDS));
    setCustomPrompt("");
  };

  const save = async () => {
    setSaving(true);
    try {
      const resp = await fetch(`${base}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annotationFields: Array.from(selectedFields),
          customPrompt: customPrompt.trim() || null,
        }),
      });
      if (!resp.ok) throw new Error("Failed to save");
      toast({ title: "Settings saved", description: "Auto-annotation will use your new configuration." });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Annotation Settings</h1>
        <p className="text-muted-foreground mt-1">
          Choose which dimensions to annotate and optionally provide a custom GPT prompt.
          These settings apply to both AI auto-annotation and the manual annotation form.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Annotation Dimensions</CardTitle>
          <CardDescription>
            Select the fields you want included. Deselected fields will be hidden in the annotation form and
            excluded from the GPT prompt.{" "}
            <Badge variant="secondary">{selectedFields.size} / {FIELD_GROUPS.length} selected</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {FIELD_GROUPS.map((field) => (
            <div key={field.id} className="flex items-start gap-3">
              <Checkbox
                id={field.id}
                checked={selectedFields.has(field.id)}
                onCheckedChange={() => toggle(field.id)}
                className="mt-0.5"
              />
              <Label htmlFor={field.id} className="cursor-pointer space-y-0.5">
                <span className="font-medium">{field.label}</span>
                <p className="text-xs text-muted-foreground font-normal">{field.description}</p>
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom GPT Prompt</CardTitle>
          <CardDescription>
            Optionally replace the default task description with your own instructions.
            Leave blank to use the built-in research prompt. The JSON output schema is
            always appended automatically based on your selected dimensions above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder={`E.g. "You are annotating social media posts about AI for a study on public trust. Focus on how users describe AI reliability and whether they express fear or optimism. Code only what is explicitly stated in the text."`}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={8}
            className="font-mono text-sm resize-y"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {customPrompt.trim()
              ? `Custom prompt active (${customPrompt.trim().length} characters). The JSON schema for selected dimensions will be appended automatically.`
              : "Using the default MoralizeAI annotation prompt."}
          </p>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex gap-3">
        <Button onClick={save} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save Settings"}
        </Button>
        <Button variant="outline" onClick={resetToDefault} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
