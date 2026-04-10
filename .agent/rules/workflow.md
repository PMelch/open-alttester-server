# Workflow Rules

## Pair Programmer

Config: `.pair-programmer/config.json`

- **Agent A** (implementer): current harness (Claude Code, current model)
- **Agent B** (reviewer): codex runner, model `gpt-5.4`, thinking level `medium`
- **Max review rounds**: 5
- **Commit after each step**: MANDATORY — every implementation step and every fix round must produce a git commit before the work is handed to Agent B. This is non-negotiable.

## Git Staging Rule

**Never use `git add .`, `git add -A`, `git add -u`, or any wildcard.**  
Always name every file explicitly: `git add src/foo.ts src/bar.ts tsconfig.json`

## Git Commit Steps

| Step | Commit message |
|------|---------------|
| Initial implementation | `pair-programmer: implementation` |
| First fix | `pair-programmer: fix-1` |
| Second fix | `pair-programmer: fix-2` |
| ... | `pair-programmer: fix-N` |

## Task Execution Order

Tasks must be executed in dependency order:

```
TASK-1.1 (protocol analysis, no deps)
  → TASK-1.2 (bootstrap, depends on 1.1)
    → TASK-1.3 (server core, depends on 1.2)
      → TASK-1.4 (dashboard, depends on 1.3)
        → TASK-1.5 (inspector, depends on 1.4)
```

## Task Status Updates

- Set task to `In Progress` before starting work.
- Set task to `Done` after Agent B approves and final commit is made.

## TDD Requirement

All tasks follow the TDD protocol (see `rules/testing.md`). No implementation code before a failing test. No exceptions.
