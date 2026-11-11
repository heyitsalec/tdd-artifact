# tdd-artifact

A skill pack with one skill, `tdd-artifact`: an agent writes a technical design document (TDD) as a markdown source,
compiles it to `content.json`, and renders it with a React app into one HTML page published as a claude.ai artifact.
The page carries mocks, diagrams with hover hotspots, a schema lane with sample rows and measured load, an agents lane
for subagents, a linter and an eval loop.

The skill itself is in [`skills/tdd-artifact/`](skills/tdd-artifact/); its instructions are
[`SKILL.md`](skills/tdd-artifact/SKILL.md).

## Install

**With the agentic-workflow toolkit.** The toolkit's `setup.sh` fetches external skill packs at a pinned commit into
`external-skills/` under its state folder and links each skill into every provider's skills directory. Once this pack
is in the toolkit's pin file, `./setup.sh` is the whole install.

**By hand.** Clone this repository anywhere and link the skill into your agent's skills directory:

```bash
git clone <this repository> ~/src/tdd-artifact
ln -s ~/src/tdd-artifact/skills/tdd-artifact ~/.claude/skills/tdd-artifact
```

The skill finds its own folder in this order, taking the first that holds a `SKILL.md`:

1. `$TDD_ARTIFACT_HOME`
2. `${AW_STATE_DIR:-$HOME/.agentic-workflow}/external-skills/tdd-artifact/skills/tdd-artifact` (the fetched pack)
3. `${AW_TOOLKIT:-$HOME/.agentic-workflow/toolkit}/skills/tdd-artifact` (a copy inside the toolkit)
4. `~/.claude/skills/tdd-artifact` (the link above)

For any other location, such as another provider's skills directory, set `TDD_ARTIFACT_HOME` to the folder that holds
`SKILL.md`.

**Then, once:**

```bash
cd skills/tdd-artifact/app && bun install    # the page renderer
cd ../cli && bun install                     # the tdd command line
```

Needs `python3`, `bun`, `node` and `git` on PATH (`skills/tdd-artifact/requires.yaml`). The page's diagram and
screenshot tools use Playwright from the vendored system-design scripts; see
`skills/tdd-artifact/vendor/system-design/`.

Without the toolkit, its preamble files and result-block helper are not there. `SKILL.md` says to skip the preamble
then, and the result block is off unless `AW_RESULT=1`, so the skill runs without them.

## What is in the skill

| Folder | What it holds |
|---|---|
| `scripts/` | The Python scripts `SKILL.md` documents: the compiler, the linter, the agents lane, the eval. |
| `app/` | The React page: server render, hydrate check, the screenshot harness. |
| `cli/` | The same tools in TypeScript under bun (`tdd build`, `lint`, `agents`, `eval`, `rev`, `components`, and more), held byte-identical to the Python by a parity gate. |
| `templates/` | The packet scaffold, the page's design tokens and CSS, and `components.json`, the catalog of every block a TDD source can use. |
| `references/` | The rules the skill follows, one file per topic. `decisions.md` indexes the numbered decisions the code cites. |
| `vendor/system-design/` | The system-design scripts the skill builds on, vendored unchanged. |

## Checks

```bash
cd skills/tdd-artifact/cli
bun run check                                 # TypeScript
bun test                                      # the suite; the CPython golden tests need python3 to be 3.13
bun bin/tdd.ts components --gallery /tmp/g    # a packet that shows every component
python3 -I ../scripts/build_tdd.py /tmp/g/gallery.md /tmp/g/build
bun run parity/gate.ts /tmp/g                 # both compilers, byte for byte
cd ../app && bunx tsc -p . --noEmit && bun run build.ts /tmp/g/build && bun run check_hydrate.ts /tmp/g/build/tdd.html
```

CI (`.github/workflows/ci.yml`) runs the same on every push and pull request.

The kernel in `cli/src/py` reproduces CPython 3.13 (Unicode 15.1). On another `python3` the golden tests skip and say
which version they found; everything else still runs.

## Changing the compiler

`scripts/build_tdd.py` and `cli/src/compile` are twins. A change to one needs the same change in the other and a new
`BUILD_TDD_SHA256` in `cli/src/compile/index.ts`; the parity gate fails until both agree. Adding a block type touches
six places, listed in `skills/tdd-artifact/app/CONTRACTS.md`.
