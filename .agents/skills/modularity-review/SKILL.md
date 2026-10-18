---
name: modularity-review
description: Analyze an existing codebase for costly coupling, leaking knowledge, weak module boundaries, low cohesion, and distributed-monolith risks using integration strength, socio-technical distance, and business volatility. Use when Codex needs to review architecture quality, explain why changes cascade across components, assess whether modules or services should be split or merged, or recommend evidence-backed modularity improvements from real code and runtime boundaries.
---

# Review Modularity

Inspect the implementation before judging the architecture. Evaluate relationships between components, not folder names in isolation.

## Load the model

Read [references/balanced-coupling.md](references/balanced-coupling.md) before classifying integrations. Read [references/review-format.md](references/review-format.md) before producing a formal report.

## Establish the frame

1. Determine the requested scope. If it is not explicit, infer the narrowest useful scope from the request and workspace.
2. State the level of abstraction being reviewed: functions, classes, packages, modules, deployables, services, or systems.
3. Read repository instructions and architecture or requirements documents that govern the scope.
4. Identify likely components, ownership boundaries, deployment units, and key business capabilities.
5. Inspect before asking questions. Ask only for missing business or organizational context that would materially change the assessment.

## Trace real integrations

Use `rg` and `rg --files` first when available. For every important relationship, inspect enough of the runtime chain to prove what is shared:

- public calls, imports, and dependency injection;
- delegated helpers and main production callers;
- shared types, schemas, generated clients, and duplicated rules;
- direct database or storage access across boundaries;
- HTTP, RPC, queue, and event contracts;
- transaction, deployment, and failure boundaries;
- closest tests that demonstrate the intended contract.

Record file and symbol evidence. Distinguish observed facts from inferences about team ownership, volatility, or design intent.

Build a working map with these fields:

| Integration | Evidence | Knowledge shared | Strength | Distance | Volatility | Confidence |
| --- | --- | --- | --- | --- | --- | --- |

Do not treat a dependency count, import graph, or directory layout as a coupling assessment by itself.

## Assess the three dimensions

For each material integration:

1. Classify integration strength as intrusive, functional, model, or contract coupling. Explain the concrete knowledge that justifies the label.
2. Assess distance across code structure, team ownership, deployment lifecycle, runtime availability, and coordination cost.
3. Assess essential business volatility. Do not infer volatility directly from commit frequency; frequent changes can be a symptom of poor boundaries.
4. Apply the qualitative balance rule. Treat the binary formula as a reasoning aid, not fake numerical precision.
5. Prioritize relationships that are both unbalanced and likely to change.

Use these severity levels:

- Critical: strong knowledge sharing across high distance in a highly volatile area.
- Significant: an unbalanced relationship in a moderately volatile area, or important implicit knowledge sharing that hides required co-change.
- Minor: low-volatility debt or low cohesion that is worth addressing opportunistically.

## Recommend boundary changes

Tie every recommendation to evidence and a specific dimension:

- Reduce strength with a published contract, stable DTO, facade, anti-corruption layer, or explicit event language.
- Reduce distance by co-locating code, ownership, lifecycle, or transaction boundaries when components must co-evolve.
- Separate unrelated responsibilities when low strength and low distance create poor cohesion.
- Accept and document an imbalance when plausible change vectors are genuinely rare and the repair cost is not justified.

Do not recommend splitting components merely to reduce dependency counts. Increasing distance makes strong knowledge sharing more expensive.

## Deliver the result

Lead with the highest-impact findings and their evidence. Include healthy boundaries when they explain why no change is needed.

Return the review in chat unless the user asks for files or the request explicitly calls for a durable report. For a formal report:

1. Write Markdown to `docs/modularity-review/YYYY-MM-DD/modularity-review.md` unless the user chooses another path.
2. Include exact file and symbol references for every finding.
3. Resolve this skill's installation directory from the loaded `SKILL.md`, then generate matching HTML with:

   ```bash
   python3 <skill-directory>/scripts/render_review.py path/to/modularity-review.md
   ```

4. Verify that both files contain the same headings, tables, findings, links, and attribution.

When reporting no issues, say what was inspected and why the observed integrations are balanced. Do not manufacture findings to fill a template.

## Attribution

Base the assessment on Vlad Khononov's [Balanced Coupling](https://coupling.dev) model. This Codex adaptation derives from [vladikk/modularity](https://github.com/vladikk/modularity), commit `bcdca9a595764b9aa88d5d8d6020f52e7f5f1f52`, under CC BY-NC-SA 4.0. Preserve the attribution footer in formal reports.
