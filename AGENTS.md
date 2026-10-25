# Project instructions

- Use the [test-driven development skill](.agents/skills/test-driven-development/SKILL.md) for coding.
- Use the [systematic debugging skill](.agents/skills/systematic-debugging/SKILL.md) for fixing bugs and issues.
- Use the [modularity design skill](.agents/skills/modularity-design/SKILL.md) when designing or revising module boundaries and contracts.
- Use the [modularity review skill](.agents/skills/modularity-review/SKILL.md) when reviewing architecture, coupling, and module boundaries.
- Use the [deep module refactor skill](.agents/skills/deep-module-refactor/SKILL.md) when simplifying interfaces and moving implementation details into the modules that own them.
- For Firefox Add-ons release preparation, submissions, or listing updates, use the [Firefox Add-ons release skill](.agents/skills/firefox-addons-release/SKILL.md).
- Preserve Instagram's native posts, interactions, and account state. No private API, account scraping, telemetry, or backend.
- Verify browser behavior in Zen; DOM fixtures alone do not prove compatibility with Instagram.
- Check browser console for issues introduced by the extension.
- Clean up when finishing a task: remove temp directories you created, and keep only current deliverables in `artifacts/` (the shipped Safari IPA and xcarchive, the submitted Firefox ZIP, store screenshots). Delete superseded or failed builds, ExportOptions plists, and logs or JSON dumps once their step has succeeded. Write one-off logs to a temp directory instead of `artifacts/`.
- Ask the user whether they would like to learn how a change works.
