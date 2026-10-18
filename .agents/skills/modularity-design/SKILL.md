---
name: modularity-design
description: Design or revise modular software architecture from functional requirements using Balanced Coupling, domain volatility, socio-technical distance, and explicit integration contracts. Use when Codex needs to define module or service boundaries, decide what should be split or co-located, create an architecture overview, specify module responsibilities and owned knowledge, document change vectors, or derive boundary-focused test specifications for a new or existing system.
---

# Design Modular Architecture

Design boundaries around knowledge and change, not nouns or technical layers alone. Produce a design that makes reasonable future changes predictable.

## Load the model and templates

Read [references/balanced-coupling.md](references/balanced-coupling.md) before evaluating boundaries. Read [references/design-templates.md](references/design-templates.md) before creating durable architecture documents.

## Establish the design context

1. Read the supplied requirements and relevant workspace documentation.
2. If the system already exists, inspect the current implementation, delegated helpers, main callers, data ownership, integration points, and closest tests.
3. Restate the functional capabilities, quality constraints, and important end-to-end flows.
4. Declare the level of abstraction being designed: packages, modules, deployables, services, or systems.
5. Identify facts and assumptions about team ownership, deployment topology, transaction boundaries, and strategic direction.
6. Ask only about ambiguity that would materially change a boundary or contract. Propose a best interpretation when a safe assumption keeps the work moving.

Do not begin with a service count or one-module-per-entity mapping.

## Classify change pressure

Group requirements into business capabilities. Classify each as:

- Core: differentiating work the organization actively evolves; usually high volatility.
- Supporting: necessary custom work that does not differentiate the business; usually lower volatility.
- Generic: a solved capability; usually low functional volatility, though its provider or implementation may still change.

For every classification, state the business rationale and plausible change vectors. Treat commit activity as supporting evidence only, not the definition of volatility.

## Propose knowledge boundaries

For each candidate module, define:

- functional responsibilities;
- knowledge it exclusively owns;
- invariants and transaction rules it protects;
- public contract and allowed dependency direction;
- data it owns and data it merely references;
- reasonable changes that should remain local;
- team and deployment ownership when relevant.

Merge responsibilities that share changing rules, invariants, or a model and therefore need low-distance co-evolution. Separate responsibilities that have independent change vectors and can communicate through a narrow contract.

Avoid empty wrappers and one-class modules. Prefer a small public interface backed by substantial hidden decisions.

## Assess every integration

Build a coupling table before finalizing boundaries:

| Integration | Knowledge shared | Strength | Distance | Volatility | Balanced? | Design action |
| --- | --- | --- | --- | --- | --- | --- |

For each row:

1. Classify strength as intrusive, functional, model, or contract.
2. Assess structural, organizational, lifecycle, runtime, and operational distance.
3. Assess essential business and implementation volatility.
4. Apply the qualitative balance rule from the reference.
5. Reduce strength at high-distance boundaries; reduce distance when high knowledge sharing is essential.
6. Document low-volatility shortcuts and the signal that should trigger reevaluation.

Do not hide a shared business rule behind an interface and relabel it contract coupling. The shared knowledge determines strength.

## Specify contracts and tests

Define each boundary precisely enough to implement:

- direction and purpose;
- commands, queries, events, or public functions;
- request, response, and error semantics;
- consistency, ordering, idempotency, and retry behavior where relevant;
- versioning and compatibility expectations;
- forbidden knowledge that must remain encapsulated.

Derive tests from the design:

- unit tests for internal rules and state transitions;
- contract tests for published inputs, outputs, and compatibility;
- boundary tests for invalid input, failures, and knowledge leakage;
- behavior tests for business scenarios across the public interface.

## Self-review the design

Before presenting it, inspect every integration again. Flag strong knowledge sharing across high distance in volatile areas, and unrelated responsibilities placed together at low distance. Revise critical and significant imbalances when the requirements allow it. Record unresolved trade-offs instead of pretending they are balanced.

## Deliver the result

Answer in chat for a focused design question. Create durable files when the user asks for architecture documentation or an implementation-ready design.

Use `docs/design/YYYY-MM-DD/` by default and follow [references/design-templates.md](references/design-templates.md). Include:

- `architecture.md` for the overall map, flows, coupling assessment, decisions, and risks;
- `{module-name}/design.md` for each module's responsibilities, owned knowledge, and contracts;
- `{module-name}/tests.md` for boundary-focused test specifications when tests are in scope.

Lead with the proposed boundary map and the important trade-offs. Do not require ceremonial approval between phases; pause only when a missing choice would materially change the result.

## Attribution

Base the design on Vlad Khononov's [Balanced Coupling](https://coupling.dev) model. This Codex adaptation derives from [vladikk/modularity](https://github.com/vladikk/modularity), commit `bcdca9a595764b9aa88d5d8d6020f52e7f5f1f52`, under CC BY-NC-SA 4.0. Preserve the attribution footer in formal architecture documents.
