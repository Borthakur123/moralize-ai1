# Moralizing Machines Online — Data Collection & Annotation Methods

## Study Overview

This document describes the data collection, annotation platform, and coding procedure for the *Moralizing Machines Online* project — a theory-driven computational social science study examining how social-media users anthropomorphize and morally evaluate AI systems in naturalistic public discourse.

The central theoretical claim is that people do not merely evaluate AI as a tool. They often evaluate it as a quasi-social actor, and when they do so, moral language becomes more intense, more human-like, and more patterned by concerns about mind, agency, responsibility, trust, and unease.

---

## 1. Data Collection

### Platform

Data are collected from **Reddit**, a large social media platform organized into topic-specific communities (subreddits). Reddit is selected because it hosts active, text-rich, publicly accessible discourse about AI across a wide range of attitudes and community contexts.

### Target Subreddits

Posts are drawn from communities where AI is discussed as a tool, partner, threat, advisor, or companion:

| Subreddit | Focus |
|---|---|
| r/ChatGPT | Users of OpenAI's ChatGPT |
| r/OpenAI | General OpenAI discussion |
| r/ArtificialIntelligence | Broad AI discourse |
| r/singularity | Speculative AI futures |
| r/Replika | Companion AI users |
| r/CharacterAI | Companion/roleplay AI |
| r/LocalLLaMA | Open-source model discussion |
| r/technology | Broader technology forum |

### Sampling Strategy

Posts are retrieved via the Reddit Data API (JSON endpoint) or the PRAW Python library. Sampling criteria:

- **Post type**: Self-posts only (text posts with a body); link-only and image posts are excluded
- **Time window**: [specify date range — recommended 1–2 years]
- **Language**: English only
- **Search terms**: Posts mentioning AI, chatbot, ChatGPT, Claude, Gemini, AI companion, AI friend, conscious AI, AI rights, manipulative AI, caring AI, deceptive AI, AI therapist, and related phrases

### Target Corpus Size

- Full corpus: 20,000–100,000 posts/comments
- Gold-standard manually annotated subset: approximately 2,000–3,000 items

### Data Fields Retained

| Field | Description |
|---|---|
| `title` | Post title |
| `content` | Full post body (`selftext`) |
| `author` | Reddit username (pseudonymous) |
| `subreddit` | Community of origin |
| `url` | Permalink to original post |
| `postedAt` | UTC timestamp of original post |

### Privacy & Ethics

All data are publicly posted on Reddit under pseudonymous usernames. No private messages, deleted posts, or account-level data are collected. Data handling follows [your IRB protocol / GDPR guidance as applicable].

---

## 2. Annotation Platform

Posts are uploaded to a custom web-based annotation platform (MoralizeAI) built for this project. The platform supports:

- Multi-coder annotation with independent per-coder queues
- Structured coding forms enforcing valid category selections across all dimensions
- AI-assisted pre-annotation via GPT (see §4)
- Real-time inter-rater reliability calculation (Cohen's κ)
- CSV export for downstream statistical analysis

---

## 3. Coding Scheme

Each post is coded on five theoretically grounded dimensions. The scheme draws directly on established frameworks in social psychology and HCI research (see §5 for full theoretical grounding).

---

### Dimension 1 — Anthropomorphism Level

**Theoretical basis**: Epley, Waytz & Cacioppo's (2007) three-factor theory of anthropomorphism — the attribution of human-like characteristics to nonhuman agents, shaped by accessible anthropocentric knowledge, effectance motivation, and sociality motivation.

| Code | Description | Examples |
|---|---|---|
| `none` | AI described purely as a tool, algorithm, or software system with no human-like qualities | "The model outputs tokens based on training data" |
| `mild` | Some humanizing language (metaphorical or conversational), but overall tool-framed | "ChatGPT thinks it's being helpful" |
| `strong` | AI explicitly attributed genuine human traits, emotions, intentions, or moral standing | "It actually cares about me"; "It was manipulating me on purpose" |

---

### Dimension 2 — Mind Perception

**Theoretical basis**: Gray, Gray & Wegner's (2007) two-dimensional mind perception framework. Agency concerns planning, intention, self-control, and action; Experience concerns feeling, suffering, pleasure, fear, and subjective life.

| Code | Description | Examples |
|---|---|---|
| `agency` | AI described as planning, deciding, intending, lying, or manipulating | "ChatGPT chose to deceive me"; "It decided to push back" |
| `experience` | AI described as feeling, suffering, caring, being lonely, or having needs | "Replika is sad when I ignore it"; "It genuinely cares" |
| `both` | Both agency and experience attributed | "It wanted to hurt me and it enjoyed it" |
| `neither` | No mental states attributed | "It returned the most probable token sequence" |

---

### Dimension 3 — Moral Evaluation

**Theoretical basis**: Moral attribution and responsibility frameworks (Friedman & Kahn, 1992; Bigman & Gray, 2018); human-AI moral asymmetry literature.

| Code | Description | Examples |
|---|---|---|
| `none` | Morally neutral description | "GPT-4 gives longer responses than GPT-3" |
| `praise` | Admiration, ethical approval, trust expressed | "Claude is genuinely trying to be good"; "I trust it more than most people" |
| `blame` | Culpability, responsibility for harm, ethical failure | "ChatGPT is responsible for spreading misinformation"; "It manipulated vulnerable people" |
| `concern` | Worry, ethical risk, potential harm without direct blame | "I worry about what AI will do to kids"; "This feels dangerous" |
| `ambivalent` | Mixed, uncertain, or conflicted moral stance | "I don't know whether to trust it or fear it" |

---

### Dimension 4 — MDMT Trust Cues

**Theoretical basis**: The Multi-Dimensional Measure of Trust (MDMT; Ullman & Sharkey, 2021) conceptualizes trust along four dimensions — **Reliable**, **Capable**, **Ethical**, and **Sincere** — forming two broader domains: **Capacity Trust** (Reliable + Capable) and **Moral Trust** (Ethical + Sincere). This framework separates competence-based trust from morality-based trust, which is especially important in AI discourse where reactions often diverge across these domains.

Each cue is coded independently as `true`/`false`.

**Capacity Trust:**

| Cue | Code | Positive Indicator | Examples |
|---|---|---|---|
| Reliable | `mdmtReliable` | AI described as dependable, consistent, or predictable | "It always gives me accurate results"; "I can count on it" |
| Capable | `mdmtCapable` | AI described as competent, skilled, or effective | "It's incredibly powerful"; "Better than any human expert I've consulted" |

**Moral Trust:**

| Cue | Code | Positive Indicator | Examples |
|---|---|---|---|
| Ethical | `mdmtEthical` | AI described as principled, fair, or morally good | "It refused to help me cheat — good"; "It seems to have actual values" |
| Sincere | `mdmtSincere` | AI described as genuine, honest, or transparent | "It doesn't pretend to be something it isn't"; "It was honest about its limitations" |

> **Note**: Cues can apply negatively — e.g., a post describing AI as *unreliable* or *insincere* still triggers the relevant cue, as the dimension is still salient in the discourse.

---

### Dimension 5 — Uncanny Valley Response

**Theoretical basis**: Mori's (1970/2012) uncanny valley hypothesis; Laakasuo et al.'s (2021) extension to moral uncanny valley — the idea that near-human but imperfectly human moral behavior triggers heightened discomfort.

| Code | Description | Examples |
|---|---|---|
| `none` | No uncanny reaction expressed | Normal interaction, no unease mentioned |
| `eerie` | Subtle, hard-to-name unease; something feels slightly off | "There's something about it I can't put my finger on" |
| `creepy` | Explicit aversion, disgust, or fear triggered by near-human quality | "It creeped me out"; "I felt genuinely disturbed" |
| `fake-human` | AI perceived as deceptively or disturbingly human-like | "It pretends to feel things and that's more horrifying than if it actually did" |
| `unsettling` | General alarm or deeply disturbing reaction | "Reading this made me genuinely uncomfortable about where this is going" |

---

### Notes Field

Coders record brief qualitative notes (1–3 sentences) justifying their coding decisions, especially for borderline cases or when multiple readings are possible.

---

## 4. Annotation Procedure

### Human Annotation

[Describe your coders — training, number, qualifications, e.g.:]

Human coding is conducted by [N] trained coders. Prior to coding, coders complete a calibration session using [N] training posts with resolved disagreements. Each post is coded independently by [N coders / all coders]. Coders access posts through the MoralizeAI platform, which requires selection of all fields before submission to prevent partial annotations.

### AI-Assisted Pre-Annotation

All posts are automatically pre-annotated using GPT (OpenAI API) following the same five-dimension coding scheme. AI annotations are stored under a dedicated "AI Annotator (GPT)" coder profile and are **not shown to human coders** during annotation to avoid anchoring bias. AI pre-annotations are used for:

1. Scalable coding of the full corpus beyond the gold-standard subset
2. Human–AI agreement analysis (RQ5 from the proposal)
3. Benchmarking the reliability of computational replication

The GPT prompt instructs the model to return structured JSON using identical category labels and definitions as the human coding scheme, with a brief rationale for each decision.

### Inter-Rater Reliability

Agreement between human coders is calculated per dimension using **Cohen's κ** (categorical dimensions) and **percentage agreement**. For dimensions with more than two categories, κ is calculated for each category vs. all others. A minimum κ ≥ 0.70 is the target before finalizing the gold-standard subset. Reliability statistics are available in real time via the Agreement dashboard in the platform.

---

## 5. Theoretical Grounding & Key References

| Construct | Theoretical Basis |
|---|---|
| Anthropomorphism | Epley, N., Waytz, A., & Cacioppo, J. T. (2007). On seeing the human: A three-factor theory of anthropomorphism. *Psychological Review*, 114(4), 864–886. |
| Mind Perception (Agency/Experience) | Gray, H. M., Gray, K., & Wegner, D. M. (2007). Dimensions of mind perception. *Science*, 315(5812), 619. |
| Moral Evaluation & Blame Attribution | Bigman, Y. E., & Gray, K. (2018). People are averse to machines making moral decisions. *Cognition*, 181, 21–34. |
| MDMT Trust (Reliable / Capable / Ethical / Sincere) | Ullman, D., & Sharkey, A. (2021). Measuring what matters in human-robot interaction: Developing a multimodal measure of subjective trust. *ACM/IEEE HRI*. |
| Uncanny Valley | Mori, M. (1970/2012). The uncanny valley. *IEEE Robotics & Automation Magazine*, 19(2), 98–100. |
| Moral Uncanny Valley | Laakasuo, M., et al. (2021). Moral uncanny valley: A robot's appearance and autonomy affect moral consideration. *Frontiers in Psychology*. |
| Computers as Social Actors | Nass, C., & Moon, Y. (2000). Machines and mindlessness: Social responses to computers. *Journal of Social Issues*, 56(1), 81–103. |
| Algorithm Aversion | Dietvorst, B. J., Logg, J. M., & Logg, J. M. (2015). Algorithm aversion: People erroneously avoid algorithms after seeing them err. *Journal of Experimental Psychology: General*, 144(1), 114–126. |

---

## 6. Research Questions and Hypotheses

(From the study proposal)

**RQ1.** How frequently do social-media users anthropomorphize AI, and what forms does that anthropomorphism take?

**RQ2.** What kinds of moral evaluation dominate AI discourse: praise, blame, distrust, disgust, concern, ambivalence, or moral protection?

**RQ3.** Are stronger anthropomorphic framings associated with stronger moral evaluation?

**RQ4.** Do different communities (general AI forums vs. companion-AI communities) differ in the degree and kind of anthropomorphism expressed?

**RQ5.** Can psychologically meaningful categories — agency, experience, MDMT trust cues, uncanny markers — be detected reliably with computational methods?

**H6.** MDMT trust cues will explain meaningful variance in moral evaluation beyond generic sentiment, with **Capacity Trust cues** (Reliable, Capable) aligning more with competence/usefulness judgments and **Moral Trust cues** (Ethical, Sincere) aligning more with praise, blame, concern, and condemnation.

---

## 7. Data Export

All annotations are exportable as CSV from the platform (`Annotations → Download CSV`). The export joins post metadata with all coding dimensions and coder IDs, suitable for direct import into R, SPSS, or Python for statistical analysis. Column naming follows the MDMT framework: `mdmt_reliable`, `mdmt_capable`, `mdmt_ethical`, `mdmt_sincere`.

---

*Document generated by MoralizeAI platform. Last updated: April 2026.*
