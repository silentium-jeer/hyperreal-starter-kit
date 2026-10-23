# Kit docs

`docs/` holds the design of this Unreal Starter Kit and the lessons that would
hold in any project started from it: goals, the shape of a system, decisions and
why they were made, measurements and dead ends (AGENTS.md rules 6 and 7a). It
never holds prose that restates code, captures (those go to the git-ignored
`wip/`), or lessons about one game built on the kit — those go into that game's
own `docs/`.

The web starter kit's lesson documents were not copied: they describe its game
and its browser renderer. Lessons that turn out to hold here are re-measured and
written again, labelled as kit lessons.

## Index

| Document | What it is |
|---|---|
| [../README.md](../README.md) | the kit reference: architecture, layout, agent tools, run, build and package, engine and content-pipeline notes, measured numbers |
| [workflow.md](./workflow.md) | the dev loop: one-time setup, a session, the edit loop, seeing and measuring, delivery, packaging |
| [../AGENTS.md](../AGENTS.md) | absolute rules for agents, with the incidents behind them |
| [../agents/AGENTS.md](../agents/AGENTS.md) | roles, routing, runtime checks, validation, repository rules |
| [../agents/WORKFLOW.md](../agents/WORKFLOW.md) | task lifecycle and handoff |
| [../agents/skills/README.md](../agents/skills/README.md) | which skills are ported, copied unchanged, or stubs to port |

## Agent tooling in this repository

### Skill links

`.claude/skills` and `.codex/skills` are directory junctions to `agents/skills`,
created by `node scripts/link-agent-skills.ts` (run from anywhere; it resolves the
repository root from its own location). It needs Node with TypeScript type
stripping (22.6 or later; 23.6 prints an experimental warning). Junctions need no
administrator rights. Both links are machine-local and belong in `.gitignore`.

### Hooks

`.claude/settings.json` wires two independent gates:

- `PreToolUse` → `.claude/hooks/block-destructive-git.mjs` (AGENTS.md rule 2).
- `PostToolUse` → `.claude/hooks/clean-code-guard.mjs` (AGENTS.md rule 6a,
  `agents/skills/clean-code`). It judges `.ts`/`.tsx`/`.js`/`.mjs`… files under
  `dev/src` and `dev/ui` only.

### Clean-code baseline

`.claude/clean-code-baseline.json` is a measurement of this repository, written by
the tool, never by hand: recorded 2026-10-23 over 96 files, 95 of them holding 398
comments (among them the web-starter-kit's own files, kept as they are), 4 with a
function over 80 lines, none over 500 lines. Regenerate it after a real cleanup,
never to make a complaint go away:

```bash
cd dev && npm run clean-code:baseline
```

It lists the tracked files with `git ls-files`, measures those under `dev/src` and
`dev/ui`, and writes the baseline.

**TypeScript for the measurement.** `scripts/lib/cleanCode.mjs` parses source with
the classic compiler API (`createSourceFile`, comment ranges, `SyntaxKind`).
TypeScript 7, which `dev/` type-checks with, ships no such API, so the guard, the
baseline script and the tests load `typescript-api`: TypeScript 6.0.3 under an npm
alias in `dev/package.json`.

**The tests** (`.claude/hooks/*.test.mjs`, `scripts/lib/cleanCode.test.mjs`) run
from the repository root, because the destructive-git suite starts the hook by its
path relative to the root:

```bash
cd dev && npm run test:agent-tools
```
