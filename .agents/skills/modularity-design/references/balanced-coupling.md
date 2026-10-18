# Balanced Coupling Field Guide

Use this reference to reason about coupling at a declared level of abstraction. The unit under review may be a function, class, package, module, deployable service, or system. Re-establish the level whenever the answer changes what counts as a boundary.

## Coupling is a design input

A useful system requires components to interact. Optimize the shape of those interactions instead of trying to eliminate all coupling. A modular design makes both the location and outcome of a reasonable change predictable.

Analyze each relationship along three dimensions.

## 1. Integration strength

Classify the knowledge one component needs about another, from strongest to weakest:

| Level | Knowledge shared | Typical evidence |
| --- | --- | --- |
| Intrusive | Private implementation details | Reading another component's tables, importing internals, depending on undocumented behavior |
| Functional | Business rules or requirements | Duplicated validations, coordinated algorithms, workflow steps that must change together |
| Model | A domain or implementation model | Shared entities, enums, schemas, or state representations that evolve together |
| Contract | An explicit integration language | Versioned API, purpose-built DTO, published event, facade, anti-corruption layer |

Classify the strongest knowledge actually required, not the transport. JSON over HTTP can still expose an internal model or duplicate a business rule. An in-process call can be contract coupling when its small public interface hides everything else.

Also record whether the relationship is explicit. Implicit functional or intrusive coupling is especially risky because required co-change is invisible.

## 2. Distance

Estimate the cost of coordinated change, not just physical file separation. Consider:

- structural distance: same function, class, package, repository, or service;
- ownership distance: same developer or team versus multiple teams or organizations;
- lifecycle distance: versioning, testing, release, and deployment independence;
- runtime distance: in-process, synchronous remote call, or asynchronous exchange;
- operational distance: failure domains, availability assumptions, and rollout coordination.

Distance is relative to the chosen abstraction. Between two modules in a monolith, the module boundary can be the highest distance relevant to a module-level review.

Moving code to separate services increases structural and lifecycle distance. Asynchronous messaging can reduce runtime dependence while increasing contract and coordination distance. Treat these as trade-offs, not automatic improvements.

## 3. Volatility

Estimate how likely the business capability or implementation choice is to change.

- Core subdomain: differentiating capability that receives active investment; usually high essential volatility.
- Supporting subdomain: necessary custom work that does not differentiate the business; usually lower volatility.
- Generic subdomain: a solved capability such as identity or payments; functional volatility is often low, but provider or implementation volatility can still be high.

Use business strategy, upcoming change vectors, provider replaceability, and domain learning. Do not substitute commit counts for essential volatility. High commit activity can be accidental volatility caused by poor design; low activity can be accidental stability caused by fear of changing the system.

## Balance the dimensions

Use the simplified rule as a diagnostic:

```text
MODULARITY = STRENGTH XOR DISTANCE
BALANCE = (STRENGTH XOR DISTANCE) OR NOT VOLATILITY
```

Interpret it qualitatively:

| Strength | Distance | Interpretation |
| --- | --- | --- |
| High | Low | High cohesion: co-locate knowledge that must evolve together |
| Low | High | Loose coupling: distant components communicate through narrow contracts |
| High | High | Tight coupling: expensive coordinated change; a distributed-monolith risk when volatile |
| Low | Low | Low cohesion: unrelated responsibilities are needlessly co-located |

The formula illustrates extremes. Real relationships are graded, so preserve evidence and uncertainty instead of assigning unsupported numbers.

Low volatility can make an imbalance tolerable, not intrinsically good. Record the assumptions and plausible change that would invalidate the decision.

## Rebalancing moves

Choose the move that addresses the diagnosed dimension:

- Lower strength: define a published language, stable API, contract-specific DTO, facade, event contract, or anti-corruption layer.
- Lower distance: merge modules or services, align ownership, share a release lifecycle, or place strongly related behavior inside one boundary.
- Improve cohesion: separate unrelated responsibilities that happen to be co-located.
- Accept debt: document why volatility is low, what signals trigger reevaluation, and what the current shortcut saves.

Do not hide functional coupling behind a new interface. If two components still implement the same changing rule, the knowledge remains duplicated.

## DDD connections

- Use bounded contexts to contain a coherent domain model.
- Use aggregates to co-locate behavior that shares invariants and transactional rules.
- Use open-host services, published languages, and anti-corruption layers when high-distance contexts need low-strength integration.
- Use subdomain classification to focus design effort on volatile, differentiating areas.

Explain DDD terms in plain language on first use.

## Evidence standard

For every assessment, be able to answer:

1. What exact knowledge crosses the boundary?
2. Where is that visible in code, contracts, tests, or runtime configuration?
3. What coordinated change would be required?
4. Why is that coordination cheap or expensive?
5. How likely is the triggering change?
6. Which assumption is least certain?

## Source

Adapted from Vlad Khononov's [Balanced Coupling](https://coupling.dev) model and [vladikk/modularity](https://github.com/vladikk/modularity), commit `bcdca9a595764b9aa88d5d8d6020f52e7f5f1f52`. Licensed under CC BY-NC-SA 4.0; see the skill's `LICENSE` file.
