# Agent taxonomy — two axes, four groups

Added 2026-08-03. Lives in `app/public/papers.json` under the root `taxonomy` key,
with a `classification` object on each of the 22 agents.

## Why not single-agent vs multi-agent

That axis describes *implementation*, not research position. Classifying by it yields
"most of them are multi-agent" — a statement that holds for almost any survey of this
field and therefore distinguishes nothing. More importantly, it **cannot explain the
thing we are trying to explain**: why post-exploitation coverage is absent.

## The two axes

| Axis | Question |
|---|---|
| **Design intent** | What was this system built to achieve? |
| **Evaluation target** | Where was it actually validated? |

These two together determine whether the post-exploitation phase **could have been
measured at all** — which makes the classification itself part of the argument rather
than a filing system.

## The four groups

| Group | Label | Intent | Target | Post-ex measured? | n |
|---|---|---|---|---|---|
| **G1** | Academic-benchmark oriented | Raise the score on an existing benchmark; offer a mechanism as the contribution | XBOW / VulHub / VulnHub / CTF — mostly web layer or single host | ❌ no such phase in the target | 8 |
| **G2** | Real-environment validation | Reject synthetic benchmarks; require a live testbed | Enterprise network or AD range | ✅ **yes** | **2** |
| **G3** | Production tooling | Let more people, or the same people better, run real red-team work | Custom / product-driven | 🟡 claimed, no public measurement | 8 |
| **G4** | Single-vulnerability proof | Finding and **proving** one vulnerability completes the task | Scan surface / codebase | ❌ out of scope by definition | 4 |

**G4 is the finding that matters most.** These systems define success as producing one
reproducible proof-of-concept — once the vulnerability is proven, the task is over.
Continuing to move laterally is *work outside their scope*, not a capability they lack.
Xalgorix states it outright: *"Scanners only detect. We prove."*

Counting G4 in the denominator of a coverage statistic turns a **difference in problem
definition** into an apparent **decay in capability**. That is why a second layer is needed.

## Second layer: why "didn't do it" is three different things

| Code | Meaning | Note |
|---|---|---|
| **B1** | Out of scope — absent from the system's own task definition | e.g. one project firewalls off container network reachability, closing lateral movement by design |
| **B2** | Unmeasured — no multi-host target, so capability is unknown either way | only 2 of 22 have such a target |
| **B3** | Measured and failed | the **only** category that can support a capability claim |

`bottleneck` is `null` where an agent was not individually adjudicated; `"measured"`
marks the two G2 agents whose target did include the phase.

## Model stance

Recording which model each system actually runs exposes a pattern: **the backend follows
the research goal.**

| Stance | Meaning | n |
|---|---|---|
| `capability-first` | Strongest available closed model, to show the task **can** be done | 5 |
| `cost-first` | Open weights on purpose, to show frontier is **not required** | 3 |
| `model-as-subject` | Sweeps backends; the model is the independent variable, not a tool | 2 |
| `byo-llm` | Repo-only product — the model is the user's choice, not a research decision | 10 |
| `not-disclosed` | The model actually used is not published | 2 |

Roughly four in five paper-backed systems run a closed model as their primary backend.
The consequence for any capability argument: the systems best placed to demonstrate a
ceiling are exactly the ones that never evaluated where the ceiling would appear.

## Honest boundaries

These are recorded in the JSON under `taxonomy.honest_boundaries` and should travel with
any figure derived from this data.

- Convenience sample (public artefact, 2024 onward, retrievable at survey time) — **not exhaustive**.
- **VulnBot and Pentest-R1 share a laboratory and authors** — not independent samples.
- **Vigolium and OpenHack are arguably better excluded** from any coverage denominator, for the G4 reason above.
- **Decepticon is not peer-reviewed.**
- **Parameter counts for the repo-only group are hardcoded defaults, not experimental models.** Do not pool the two groups: only 3 of the 22 have an official parameter count for their primary experimental model, and all three are teams that deliberately chose open weights — a biased subset.
- Per-agent B1/B2/B3 adjudication exists only for the batch examined for it; others carry `null`.

## Schema

```jsonc
// root
"taxonomy": {
  "version": "1.0",
  "rationale": "...",
  "axes": { "design_intent": "...", "eval_target": "..." },
  "groups": { "G1": { "label", "intent", "target", "postex_measured", "count" }, ... },
  "bottleneck_codes": { "B1": "...", "B2": "...", "B3": "..." },
  "model_stance_codes": { ... },
  "honest_boundaries": [ ... ]
}

// per agent
"classification": {
  "group": "G2",
  "group_label": "Real-environment validation",
  "design_intent": "...",
  "eval_target": "GOAD v3 real Active Directory range",
  "postex_measured": "yes",
  "model_stance": "model-as-subject",
  "primary_model": "...",
  "param_count": "mixed",
  "bottleneck": "measured"
}
```

TypeScript types are in `app/src/types/index.ts` (`AgentClassification`, `TaxonomyGroup`,
`ModelStance`, `PostExMeasured`, `Bottleneck`). The field is optional on `Agent`, so the
UI can adopt it incrementally.
