#!/usr/bin/env bun
import { runCli } from "../src/cli.ts";
await runCli(process.argv.slice(2), process.env as Record<string, string | undefined>);
