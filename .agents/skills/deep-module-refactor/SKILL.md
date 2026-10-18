---
name: deep-module-refactor
description: "Refactor software toward deep modules: small public interfaces, richer internal implementation, stronger information hiding, and clearer ownership boundaries. Use when Codex is asked to improve architecture, reduce shallow pass-through layers, simplify call sites, consolidate scattered workflow logic, design or review service/data-source/API boundaries, or apply John Ousterhout-style deep modules and pull complexity downward principles in a codebase."
---

# Deep Module Refactor

Use this skill to refactor code so each module exposes a small, intention-revealing interface while hiding meaningful implementation complexity.

## Core Goal

Prefer modules where callers express intent and the module absorbs workflow detail.

```text
Deep module: small interface + substantial hidden implementation
Shallow module: broad interface + little hidden complexity
```

The result should reduce caller knowledge, change amplification, and scattered business rules. It should not merely move code around.

## Workflow

1. Locate the current workflow entry points and the call sites that suffer most from orchestration, repeated setup, parameter threading, or implementation knowledge.
2. Identify the design decisions currently leaking across boundaries: storage details, fallback order, retry policy, validation rules, parsing steps, transaction timing, sync behavior, configuration constants, or sequencing constraints.
3. Choose the module that should own those decisions. Prefer an existing service, repository, data source, adapter, or domain component before adding a new abstraction.
4. Design the smallest caller-facing API that expresses the common task directly. Prefer task-level names such as `save(url:)`, `refreshContent(for:)`, `archive(_:)`, or `loadDashboard()` over step-level names such as `parse`, `insert`, `saveContext`, and `scheduleSync` exposed to the same caller.
5. Pull complexity downward into the chosen module. Keep sequencing, fallbacks, normalization, persistence details, and error handling behind the interface when callers should not need to know them.
6. Update call sites to depend on the deeper interface. Remove pass-through methods, duplicated orchestration, and parameters that only exist because implementation details leaked outward.
7. Check the resulting boundaries for dependency direction, testability, and local project rules before finishing.

## Refactor Heuristics

- Treat repeated call-site choreography as a strong signal that the callee is too shallow.
- Treat broad parameter lists as a signal that the caller knows too much.
- Treat classes whose methods simply forward to another layer as suspicious unless they translate concepts, enforce policy, or stabilize a boundary.
- Make a module more general only enough to cover current repeated needs. Do not build speculative frameworks.
- Keep uncommon options available without making every caller think about them.
- Prefer fewer, more capable methods over many tiny methods when the tiny methods force callers to understand the workflow.
- Prefer cohesive larger modules over many small classes that split one design decision across files.
- Preserve useful seams for tests, but do not expose internals solely for test convenience.

## What To Avoid

- Do not equate "deep" with "large." Size is acceptable only when it hides real complexity behind a cleaner interface.
- Do not bury unrelated responsibilities in one object. Deep modules still need a coherent reason to exist.
- Do not add wrapper layers that only rename another API.
- Do not break dependency direction to make a call site shorter.
- Do not refactor public APIs broadly unless the request or existing blast radius justifies it.
- Do not remove explicit behavior that callers genuinely need to control.

## Implementation Guidance

When editing a codebase:

1. Follow the repository's architecture, naming, concurrency, and validation rules first.
2. Read the smallest set of files needed to understand the target workflow and affected call sites.
3. State the intended boundary shift before editing when the change is substantial.
4. Make the deeper module own exactly one coherent design decision or workflow.
5. Keep protocols or interfaces at the deeper task level when the project uses them for testability.
6. Move tests or add focused coverage when behavior moves across boundaries.
7. Summarize the refactor by naming what complexity moved inward and what caller knowledge was removed.

## Review Checklist

Use this checklist before finalizing:

- Can the common caller now perform the task with fewer steps?
- Did a real design decision move into one owner?
- Did the public interface get smaller, clearer, or more intention-revealing?
- Are fewer implementation details visible to views, controllers, handlers, commands, or other outer layers?
- Can future changes to storage, parsing, fallback, validation, or sequencing happen inside one module?
- Did the refactor avoid speculative generality and unrelated cleanup?

## Example Shape

Before:

```swift
let metadata = try await metadataDataSource.fetch(url)
let content = try await contentDataSource.parse(url, metadata: metadata)
let item = ReadingItem(url: url, metadata: metadata, content: content)
modelContext.insert(item)
try modelContext.save()
try await syncScheduler.schedule()
```

After:

```swift
try await readingListService.save(url)
```

The service now owns parsing, fallback, persistence, and sync scheduling. The caller owns only the user intent.
