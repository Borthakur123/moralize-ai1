# Moralizing Machines Online — Data Collection & Annotation Methods

## Study Overview

This document describes the data collection, annotation platform, and coding procedure for the *Moralizing Machines Online* project, a computational social science study examining how users of online communities anthropomorphize and morally evaluate AI systems in naturalistic discourse.

---

## 1. Data Collection

### Platform

Data are collected from Reddit, a large social media platform organized into topic-specific communities (subreddits). Reddit is selected because it hosts active, text-rich public discourse about AI systems across a wide range of user attitudes and subreddit contexts.

### Target Subreddits

Posts are drawn from subreddits with demonstrated discourse about AI systems, including but not limited to:

| Subreddit | Focus |
|---|---|
| r/ChatGPT | Users of OpenAI's ChatGPT |
| r/replika | Users of the Replika companion AI |
| r/singularity | Speculative AI futures |
| r/ArtificialIntelligence | General AI discussion |
| r/ClaudeAI | Users of Anthropic's Claude |

### Sampling Strategy

Posts are retrieved via the Reddit Data API (JSON endpoint) or the PRAW Python library. Sampling criteria:

- **Post type**: Self-posts only (text posts with a body); link/image posts without body text are excluded
- **Time window**: [specify date range]
- **Minimum engagement**: [optional: e.g. ≥5 upvotes or ≥1 comment to ensure community visibility]
- **Language**: English only

### Data Fields Retained

For each post, the following fields are retained:

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
- Structured coding forms enforcing valid category selections
- AI-assisted pre-annotation (see §4)
- Inter-rater reliability calculation
- CSV export for downstream analysis

---

## 3. Coding Scheme

Each post is coded on five dimensions. The scheme draws on established frameworks in social psychology and HCI research (see §5 for theoretical grounding).

### Dimension 1 — Anthropomorphism Level

*Extent to which the post attributes human-like qualities to the AI.*

| Code | Description |
|---|---|
| `none` | AI described purely as a tool, algorithm, or software system |
| `mild` | Some humanizing language (metaphorical or conversational), but overall tool-framed |
| `strong` | AI attributed genuine human traits, emotions, intentions, or moral standing |

### Dimension 2 — Mind Perception

*Type of mental states attributed to the AI, following Gray et al. (2007).*

| Code | Description |
|---|---|
| `agency` | AI described as planning, deciding, intending, lying, or manipulating |
| `experience` | AI described as feeling, suffering, caring, or having needs |
| `both` | Both agency and experience attributed |
| `neither` | No mental states attributed |

### Dimension 3 — Moral Evaluation

*Primary moral stance expressed toward the AI or its behavior.*

| Code | Description |
|---|---|
| `none` | Morally neutral description |
| `praise` | Admiration, trust, ethical approval |
| `blame` | Culpability, responsible for harm, ethical failure |
| `concern` | Worry, ethical risk, potential harm |
| `ambivalent` | Mixed or uncertain moral stance |

### Dimension 4 — VASS Cues

*Value Alignment & Social Signals — four binary cues indicating specific social and moral attributions to the AI.*

| Cue | Code | Positive Indicator |
|---|---|---|
| Values & Morals | `vassValues` | AI described as having ethical values, principles, or a conscience |
| Autonomy | `vassAutonomy` | AI described as self-directed, independent, or acting outside explicit instructions |
| Social Connection | `vassSocialConnection` | AI framed as a friend, companion, partner, or relationship object |
| Self-Aware Emotions | `vassSelfAwareEmotions` | AI described as emotionally reflective or aware of its own inner states |

Each cue is coded `true`/`false` independently.

### Dimension 5 — Uncanny Valley Response

*Evidence of discomfort or unease arising from the AI's near-human quality.*

| Code | Description |
|---|---|
| `none` | No uncanny reaction expressed |
| `eerie` | Subtle, hard-to-name unease |
| `creepy` | Explicit aversion, disgust, or fear |
| `fake-human` | AI perceived as deceptively or disturbingly human-like |
| `unsettling` | General alarm or disturbing reaction not fitting the above |

### Notes Field

Coders record brief qualitative notes (1–3 sentences) justifying their coding decisions, particularly for borderline cases.

---

## 4. Annotation Procedure

### Human Annotation

[Describe your coders — training, number, qualifications, e.g.:]

Human coding is conducted by [N] trained coders. Prior to coding, coders complete a calibration session using [N] training posts with resolved disagreements. Each post is coded independently by [N coders / all coders]. Coders access posts through the MoralizeAI platform, which enforces selection of all required fields before submission.

### AI-Assisted Pre-Annotation

As a supplementary measure, all posts are automatically pre-annotated using GPT (gpt-5-mini via OpenAI API) following the same coding scheme. AI annotations are stored under a dedicated "AI Annotator" coder profile and are not shown to human coders during annotation to avoid anchoring bias. AI pre-annotations are used for:

1. Comparison of AI vs. human coding patterns
2. Reliability benchmarking (human–AI agreement)
3. Exploratory analysis of scaling potential

The GPT prompt instructs the model to return structured JSON with all five dimensions and a brief rationale, using identical category labels and definitions as the human coding scheme.

### Inter-Rater Reliability

Agreement between coders is calculated per dimension using Cohen's κ (for categorical dimensions) and percentage agreement. Reliability statistics are available in real time via the Agreement dashboard in the platform.

---

## 5. Theoretical Grounding

| Construct | Theoretical Basis |
|---|---|
| Anthropomorphism | Epley, Waytz & Cacioppo (2007). On seeing the human. *Psychological Review* |
| Mind Perception (Agency/Experience) | Gray, Gray & Wegner (2007). Dimensions of mind perception. *Science* |
| Moral Evaluation | Moral attribution frameworks in HCI; Friedman & Kahn (1992) |
| VASS Cues | [Insert your source — e.g. original framework paper or your own operationalization] |
| Uncanny Valley | Mori (1970/2012). The uncanny valley. *IEEE Robotics & Automation Magazine* |

---

## 6. Data Export

All annotations are exportable as CSV from the platform (`Annotations → Download CSV`). The export joins post metadata with all coding dimensions and coder IDs, suitable for direct import into R, SPSS, or Python for statistical analysis.

---

*Document generated by MoralizeAI platform. Last updated: April 2026.*
