// The line that sets T (this skill's folder) in SKILL.md: it finds the skill in each place an install puts it, in a
// fixed order, stops with a message when it finds none, and reads the same in every doc that repeats it.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SKILL } from "../../src/components";

const START = 'T="$(for d in ';
const END = 'the folder that holds its SKILL.md}"';

/** The resolver, from `T="$(for d in` to the end of the not-found guard, as SKILL.md has it. */
function resolver(file: string): string {
  const text = readFileSync(join(SKILL, file), "utf8");
  const a = text.indexOf(START);
  const b = text.indexOf(END, a);
  if (a < 0 || b < 0) throw new Error(`${file}: no line that sets T`);
  return text.slice(a, b + END.length);
}

const LINE = resolver("SKILL.md");
const DOCS = ["app/CONTRACTS.md", "references/schema-lane.md", "references/diagram-conventions.md", "templates/tdd-system/README.md"];
const SHELLS = ["/bin/bash", "/bin/zsh", "/bin/sh", "/bin/dash"].filter((s) => existsSync(s));

/** A skill folder (just its SKILL.md) at `dir`. */
function skillAt(dir: string): string {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), "---\nname: tdd-artifact\n---\n");
  return dir;
}

function run(shell: string, home: string, env: Record<string, string> = {}): { code: number | null; out: string; err: string } {
  const r = spawnSync(shell, ["-c", `${LINE}\nprintf '%s' "$T"`], {
    env: { PATH: "/usr/bin:/bin", HOME: home, ...env },
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

describe("the line that sets T", () => {
  test("every doc that repeats it carries SKILL.md's line, character for character", () => {
    for (const doc of DOCS) expect(resolver(doc)).toBe(LINE);
  });

  test("it is one command that starts with T=, as the skill's allowed tools require", () => {
    expect(LINE.startsWith('T="$(')).toBe(true);
    expect(LINE.includes("\n")).toBe(false);
    const front = readFileSync(join(SKILL, "SKILL.md"), "utf8").split("\n---\n")[0];
    expect(front).toContain("Bash(T=*)");
  });

  for (const shell of SHELLS) {
    describe(shell, () => {
      test("order: TDD_ARTIFACT_HOME, the external pack, the toolkit, the provider link", () => {
        const home = mkdtempSync(join(tmpdir(), "tdd-home-"));
        try {
          const state = join(home, ".agentic-workflow");
          const link = join(home, ".claude", "skills", "tdd-artifact");
          const toolkit = join(state, "toolkit", "skills", "tdd-artifact");
          const pack = join(state, "external-skills", "tdd-artifact", "skills", "tdd-artifact");
          const elsewhere = join(home, "src", "tdd-artifact");

          // Nothing installed: the line stops, and says how to go on.
          const none = run(shell, home);
          expect(none.code).not.toBe(0);
          expect(none.out).toBe("");
          expect(none.err).toContain("tdd-artifact not found: set TDD_ARTIFACT_HOME");

          // A plain symlink install: the provider's link, as given.
          const real = skillAt(join(home, "checkout", "skills", "tdd-artifact"));
          mkdirSync(join(home, ".claude", "skills"), { recursive: true });
          symlinkSync(real, link);
          expect(run(shell, home)).toEqual({ code: 0, out: link, err: "" });

          // The toolkit's own copy wins over the link.
          skillAt(toolkit);
          expect(run(shell, home).out).toBe(toolkit);

          // The fetched pack wins over the toolkit's copy.
          skillAt(pack);
          expect(run(shell, home).out).toBe(pack);

          // TDD_ARTIFACT_HOME wins over all of them; one that holds no SKILL.md is passed over.
          skillAt(elsewhere);
          expect(run(shell, home, { TDD_ARTIFACT_HOME: elsewhere }).out).toBe(elsewhere);
          expect(run(shell, home, { TDD_ARTIFACT_HOME: join(home, "nowhere") }).out).toBe(pack);
        } finally {
          rmSync(home, { recursive: true, force: true });
        }
      });

      test("the state folder and the toolkit follow AW_STATE_DIR, AW_STATE_ROOT and AW_TOOLKIT", () => {
        const home = mkdtempSync(join(tmpdir(), "tdd-home-"));
        try {
          const dir = join(home, "state-dir");
          const root = join(home, "state-root");
          const kit = join(home, "kit");
          const inDir = skillAt(join(dir, "external-skills", "tdd-artifact", "skills", "tdd-artifact"));
          const inRoot = skillAt(join(root, "external-skills", "tdd-artifact", "skills", "tdd-artifact"));
          const inKit = skillAt(join(kit, "skills", "tdd-artifact"));
          expect(run(shell, home, { AW_TOOLKIT: kit }).out).toBe(inKit);
          expect(run(shell, home, { AW_TOOLKIT: kit, AW_STATE_ROOT: root }).out).toBe(inRoot);
          expect(run(shell, home, { AW_TOOLKIT: kit, AW_STATE_ROOT: root, AW_STATE_DIR: dir }).out).toBe(inDir);
        } finally {
          rmSync(home, { recursive: true, force: true });
        }
      });

      test("a folder with a space in its name comes back whole", () => {
        const home = mkdtempSync(join(tmpdir(), "tdd home "));
        try {
          const at = skillAt(join(home, "my skills", "tdd-artifact"));
          expect(run(shell, home, { TDD_ARTIFACT_HOME: at })).toEqual({ code: 0, out: at, err: "" });
        } finally {
          rmSync(home, { recursive: true, force: true });
        }
      });
    });
  }
});
