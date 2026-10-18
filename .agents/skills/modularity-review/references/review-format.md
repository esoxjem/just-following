# Modularity Review Format

Use this structure for a durable report. Omit empty issue sections and add project-specific evidence where it improves actionability.

## Required structure

```markdown
# Modularity Review

**Scope**: [scope and abstraction level]
**Date**: [YYYY-MM-DD]

## Executive Summary

[What the system does, overall modularity status, and the most important finding.]

## Coupling Overview

| Integration | Evidence | [Strength](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) | [Distance](https://coupling.dev/posts/dimensions-of-coupling/distance/) | [Volatility](https://coupling.dev/posts/dimensions-of-coupling/volatility/) | [Assessment](https://coupling.dev/posts/core-concepts/balance/) |
| --- | --- | --- | --- | --- | --- |
| A -> B | `path/file.ext:line` | [Model](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) | High: separate teams and deployables | High: core capability | Unbalanced |

## Findings

### [P1] Short finding title

**Integration**: Component A -> Component B  
**Evidence**: `path/file.ext:symbol`, `path/test.ext:test name`  
**Severity**: Critical

#### Knowledge crossing the boundary

[Name the private detail, rule, model, or contract. Distinguish observed facts from inference.]

#### Change impact

[Give a plausible change and the required cascading edits, coordination, deployment, or operational risk.]

#### Why it is unbalanced

[Explain strength, distance, volatility, and uncertainty.]

#### Recommended improvement

[Propose a concrete boundary or contract change, its trade-offs, and the verification needed.]

## Healthy Boundaries

[Record important integrations that are balanced and should not be refactored.]

## Assumptions and Unresolved Risks

[List uncertain team, deployment, domain, or volatility assumptions and the condition that should trigger reevaluation.]

---

_This analysis uses the [Balanced Coupling](https://coupling.dev) model by [Vlad Khononov](https://vladikk.com). The Codex workflow is adapted from [vladikk/modularity](https://github.com/vladikk/modularity) under CC BY-NC-SA 4.0._
```

## Ordering

Order actionable findings by severity and leverage, not file location. Use P1/P2/P3 only when the review context benefits from code-review-style priorities:

- P1: critical, likely, and expensive change propagation;
- P2: significant design risk worth planning;
- P3: localized or opportunistic improvement.

## Links

Link the first use of each model concept in every formal report:

| Concept | URL |
| --- | --- |
| Balance rule, tight/loose coupling, cohesion | https://coupling.dev/posts/core-concepts/balance/ |
| Integration strength and its four levels | https://coupling.dev/posts/dimensions-of-coupling/integration-strength/ |
| Distance, lifecycle, runtime, or team boundaries | https://coupling.dev/posts/dimensions-of-coupling/distance/ |
| Volatility and subdomain classification | https://coupling.dev/posts/dimensions-of-coupling/volatility/ |
| Complexity and unpredictable change | https://coupling.dev/posts/core-concepts/complexity/ |
| Modularity and predictable change | https://coupling.dev/posts/core-concepts/modularity/ |
| Domain-driven design | https://coupling.dev/posts/related-topics/domain-driven-design/ |

## No-finding reports

If no critical or significant issue is supported, say so plainly. Keep the evidence table, healthy boundaries, and assumptions; do not add speculative findings merely to populate the report.
