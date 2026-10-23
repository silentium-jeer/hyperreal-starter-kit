# CLAUDE.md

The project rules are in [AGENTS.md](./AGENTS.md). Read them first.

## Comments are banned

Do not write comments in code. None: no line comments, no block comments, no docstrings,
no JSDoc, in any language. The only exception is a comment the user has explicitly allowed in
the conversation; write it marked `@important`, and never set that marker on your own decision.

- Say it in a name: extract a function or a constant whose name says what the comment would.
- Anything worth keeping that a name cannot carry — a measurement, a source, a dead end, a
  launch command — goes into `docs/`, never beside the code.
- Toolchain directives the build needs (`// @ts-expect-error`, `/// <reference>`,
  `eslint-disable`) are not comments and stay.

AGENTS.md rule 6a says the same at length.
