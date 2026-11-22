#!/usr/bin/env python3
"""Sync tauri-runtime-cef from tauri-apps/tauri feat/cef branch.

Copies ALL upstream files. Only preserves fork-only examples.
The PR diff shows every upstream change including overlay modules.
User re-applies fork patches on top manually.

Also writes a divergence report (SYNC_REPORT, default /tmp/sync-report.md)
covering the two things the PR diff cannot show, because both compare the
fork against upstream *before* the copy overwrites it:

  * fork-only files, which survive the copy and so never appear in the diff;
  * upstream items absent from the fork, i.e. upstream fixes a previous
    manual conflict resolution dropped on the floor.

The second is not hypothetical: upstream's `TerminationSignals` (restoring
the SIGINT/SIGTERM/SIGHUP handlers CEF replaces, without which the app
ignores the first termination signal) was lost this way in the cef 150 port
and went unnoticed because the reindentation made the diff unreviewable.
"""

import os
import re
import shutil
from pathlib import Path

UPSTREAM = Path(os.environ.get("UPSTREAM_DIR", "/tmp/upstream/crates/tauri-runtime-cef"))
FORK_ROOT = Path(os.environ.get("FORK_ROOT", "."))
# Kept outside FORK_ROOT: the workflow runs `git add -A`.
REPORT = Path(os.environ.get("SYNC_REPORT", "/tmp/sync-report.md"))

FORK_ONLY_PRESERVE = {
    "examples/codec_probe.rs",
    "examples/stream_probe.rs",
    "examples/sw_probe.rs",
}

# Item definitions, at any indentation so `impl` methods count too.
ITEM = re.compile(
    r"^\s*(?:pub\s*(?:\([^)]*\)\s*)?)?(?:default\s+)?(?:async\s+)?(?:unsafe\s+)?"
    r'(?:extern\s+"[^"]*"\s+)?(fn|struct|enum|trait|union|type|const|static|mod)\s+'
    r"([A-Za-z_][A-Za-z0-9_]*)",
    re.MULTILINE,
)


def items(text):
    """Named item definitions in `text`, as {(kind, name)}."""
    return {(m.group(1), m.group(2)) for m in ITEM.finditer(text)}


def read(path):
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None


def report(upstream, fork):
    """Compare pre-sync fork against upstream. Returns markdown."""
    upstream_rel = {
        str(f.relative_to(upstream)) for f in upstream.rglob("*") if f.is_file()
    }

    fork_only = sorted(
        rel
        for rel in (
            str(f.relative_to(fork))
            for f in fork.rglob("*")
            if f.is_file() and ".git" not in f.parts and "target" not in f.parts
        )
        if rel not in upstream_rel and (rel.startswith("src/") or rel.startswith("examples/"))
    )

    dropped = []
    for rel in sorted(upstream_rel):
        if not rel.endswith(".rs"):
            continue
        fork_text = read(fork / rel)
        if fork_text is None:
            continue  # new file upstream; the diff shows it
        missing = items(read(upstream / rel) or "") - items(fork_text)
        for kind, name in sorted(missing):
            dropped.append((rel, kind, name))

    out = ["## Divergence report", ""]

    out.append(f"### Fork-only files ({len(fork_only)})")
    out.append("")
    out.append("Not in upstream, so they survive the copy and never show in this PR's diff.")
    out.append("")
    out += [f"- `{rel}`" for rel in fork_only] or ["_none_"]
    out.append("")

    out.append(f"### Upstream items not present in the fork ({len(dropped)})")
    out.append("")
    out.append(
        "Each is either a deliberate fork removal or an upstream fix a previous sync "
        "dropped. **Deliberate removals in this repo always carry a comment explaining "
        "why — an entry you cannot find a rationale for is a regression.**"
    )
    out.append("")
    if dropped:
        out.append("| File | Kind | Item |")
        out.append("| --- | --- | --- |")
        out += [f"| `{rel}` | {kind} | `{name}` |" for rel, kind, name in dropped]
    else:
        out.append("_none_")
    out.append("")

    return "\n".join(out)


def main():
    upstream = UPSTREAM
    fork = FORK_ROOT

    # Must run before the copy: afterwards the fork *is* upstream.
    text = report(upstream, fork)

    saved = {}
    for rel in FORK_ONLY_PRESERVE:
        p = fork / rel
        if p.exists():
            saved[rel] = p.read_bytes()

    copied = 0
    for f in upstream.rglob("*"):
        if not f.is_file():
            continue
        rel = str(f.relative_to(upstream))
        dest = fork / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(f, dest)
        copied += 1

    for rel, data in saved.items():
        p = fork / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(text, encoding="utf-8")

    print(f"Copied {copied} from upstream, preserved {len(saved)} fork-only examples")
    print()
    print(text)


if __name__ == "__main__":
    main()
