# Modular Architecture Document Templates

Use these templates for durable output. Keep names, contracts, and tests specific to the system; remove placeholder prose and omit sections that are truly irrelevant.

## Output tree

```text
docs/design/YYYY-MM-DD/
├── architecture.md
└── module-name/
    ├── design.md
    └── tests.md
```

## Architecture overview

```markdown
# Architecture Overview

**Date**: YYYY-MM-DD
**Scope**: [system and abstraction level]

## Requirements Summary

[Functional capabilities, quality constraints, and excluded scope.]

## Domain Classification

| Capability | Classification | Volatility | Rationale and change vectors |
| --- | --- | --- | --- |

## Module Map

| Module | Responsibility | Owned knowledge | Owner/deployable |
| --- | --- | --- | --- |

## Key Flows

### Flow name

1. [Module and action]
2. [Contract and data/control transfer]
3. [Outcome and failure behavior]

## Coupling Assessment

| Integration | Knowledge shared | [Strength](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) | [Distance](https://coupling.dev/posts/dimensions-of-coupling/distance/) | [Volatility](https://coupling.dev/posts/dimensions-of-coupling/volatility/) | [Balanced?](https://coupling.dev/posts/core-concepts/balance/) | Decision |
| --- | --- | --- | --- | --- | --- | --- |

## Design Decisions and Trade-offs

### Decision title

- Context: [forces and constraints]
- Choice: [selected boundary or contract]
- Alternatives: [credible alternatives]
- Coupling rationale: [strength, distance, and volatility]
- Consequences: [benefits, costs, and operational effects]

## Unresolved Risks

| Risk or assumption | Impact | Signal to revisit | Mitigation |
| --- | --- | --- | --- |

---

_This design uses the [Balanced Coupling](https://coupling.dev) model by [Vlad Khononov](https://vladikk.com). The Codex workflow is adapted from [vladikk/modularity](https://github.com/vladikk/modularity) under CC BY-NC-SA 4.0._
```

## Module design

```markdown
# Module Name

## Functional Responsibilities

[Business capabilities and behavior this module implements.]

## Encapsulated Knowledge

[Domain rules, model, invariants, provider details, algorithms, and implementation decisions owned only here.]

## Subdomain Classification

[Core, supporting, or generic; explain business volatility and implementation volatility.]

## Data and Invariants

- Owned data: [records and state]
- Referenced data: [identifiers or read models from elsewhere]
- Invariants: [rules protected inside the boundary]
- Transaction boundary: [atomicity and consistency]

## Public Interface

[Commands, queries, events, or functions. Define inputs, outputs, errors, and forbidden dependencies.]

## Integration Contracts

### Dependency or consumer

- Direction: A -> B
- Purpose: [why the integration exists]
- Strength: [contract, model, functional, or intrusive with rationale]
- Shared knowledge: [exact schema, rule, or model]
- Semantics: [success, errors, ordering, idempotency, retry, consistency]
- Compatibility: [versioning and rollout expectations]

## Change Vectors

[Reasonable changes that should affect only this module.]

## Operational Boundaries

[Ownership, deployment, runtime dependencies, availability, and observability.]

## Open Questions

[Unresolved decisions that block or constrain implementation.]
```

## Module test specification

```markdown
# Module Name - Test Specification

## Unit Tests

### Test name

- Scenario: [internal rule or state transition]
- Expected behavior: [observable result]

## Integration Contract Tests

### Test name

- Scenario: [published request, response, event, or compatibility case]
- Expected behavior: [contract guarantee]

## Boundary Tests

### Test name

- Scenario: [invalid input, failure, concurrency, or attempted knowledge leak]
- Expected behavior: [rejection, containment, or recovery]

## Behavior Tests

### Test name

- Scenario: [outside-in business case through the public interface]
- Expected behavior: [business outcome]
```

## Completeness checks

Before finishing, verify that:

- every requirement maps to at least one module responsibility and behavior test;
- every cross-module flow names a contract and dependency direction;
- every owned rule or invariant has exactly one authoritative home;
- every high-distance relationship uses a suitably narrow language or records why it cannot;
- every low-volatility shortcut names a plausible trigger for reevaluation;
- architecture and module documents describe the same boundaries.
