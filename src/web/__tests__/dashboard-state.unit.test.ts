import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FetchHandler, ServerAdapter, UpgradeHandler, WsHandlers } from "../../server/adapter";
import { createUiTesterServer } from "../../server/server";

class CapturingAdapter implements ServerAdapter {
  fetchHandler: FetchHandler | null = null;

  setFetchHandler(handler: FetchHandler): void {
    this.fetchHandler = handler;
  }

  setUpgradeHandler(_handler: UpgradeHandler): void {}

  setWebSocketHandlers(_handlers: WsHandlers): void {}

  async listen(port: number): Promise<number> {
    return port || 13000;
  }

  close(): void {}
}

describe("Dashboard state", () => {
  it("exposes the server launch directory as the default agent project folder", async () => {
    const adapter = new CapturingAdapter();
    const server = await createUiTesterServer({ port: 0, adapter });
    try {
      const response = await adapter.fetchHandler?.(new Request("http://localhost/dashboard/state"));
      expect(response).toBeInstanceOf(Response);

      const body = await (response as Response).json() as { projectFolder?: string };
      expect(body.projectFolder).toBe(process.cwd());
    } finally {
      server.stop();
    }
  });

  it("persists project agent overrides and MCP config under agent project folders", async () => {
    const projectFolder = mkdtempSync(join(tmpdir(), "open-uitester-agent-config-"));
    const adapter = new CapturingAdapter();
    const server = await createUiTesterServer({ port: 0, adapter, projectFolder });
    try {
      const response = await adapter.fetchHandler?.(new Request("http://localhost/dashboard/agent-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "project",
          projectFolder,
          mcpEndpoint: "http://localhost:13000/mcp",
          agents: { codex: true, claude: true, gemini: true, cursor: true, opencode: true, pi: true },
          permissions: { inspect: true, commands: true, "multi-app": false },
          allowlistedCommands: ["hierarchy.query", "command.invoke"],
        }),
      }));
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(200);

      const body = await (response as Response).json() as { paths?: Record<string, string> };
      expect(body.paths?.codexConfig).toBe(join(projectFolder, ".codex", "config.toml"));
      expect(body.paths?.codexMcp).toBe(join(projectFolder, ".codex", "mcp.json"));
      expect(body.paths?.codexAgents).toBe(join(projectFolder, ".codex", "agents.json"));
      expect(body.paths?.claudeMcp).toBe(join(projectFolder, ".mcp.json"));
      expect(body.paths?.geminiSettings).toBe(join(projectFolder, ".gemini", "settings.json"));
      expect(body.paths?.cursorMcp).toBe(join(projectFolder, ".cursor", "mcp.json"));
      expect(body.paths?.opencodeConfig).toBe(join(projectFolder, "opencode.json"));
      expect(body.paths?.piMcp).toBe(join(projectFolder, ".pi", "mcp.json"));

      const codexConfig = readFileSync(join(projectFolder, ".codex", "config.toml"), "utf8");
      expect(codexConfig).toContain("[mcp_servers.open-uitester-server]");
      expect(codexConfig).toContain('url = "http://localhost:13000/mcp"');

      const codexMcp = JSON.parse(readFileSync(join(projectFolder, ".codex", "mcp.json"), "utf8")) as {
        mcpServers: Record<string, { url: string }>;
      };
      expect(codexMcp.mcpServers["open-uitester-server"].url).toBe("http://localhost:13000/mcp");

      const claudeMcp = JSON.parse(readFileSync(join(projectFolder, ".mcp.json"), "utf8")) as {
        mcpServers: Record<string, { type: string; url: string }>;
      };
      expect(claudeMcp.mcpServers["open-uitester-server"]).toEqual({
        type: "http",
        url: "http://localhost:13000/mcp",
      });

      const geminiSettings = JSON.parse(readFileSync(join(projectFolder, ".gemini", "settings.json"), "utf8")) as {
        mcpServers: Record<string, { httpUrl: string }>;
      };
      expect(geminiSettings.mcpServers["open-uitester-server"].httpUrl).toBe("http://localhost:13000/mcp");

      const cursorMcp = JSON.parse(readFileSync(join(projectFolder, ".cursor", "mcp.json"), "utf8")) as {
        mcpServers: Record<string, { url: string }>;
      };
      expect(cursorMcp.mcpServers["open-uitester-server"].url).toBe("http://localhost:13000/mcp");

      const opencodeConfig = JSON.parse(readFileSync(join(projectFolder, "opencode.json"), "utf8")) as {
        mcp: Record<string, { type: string; url: string; enabled: boolean }>;
      };
      expect(opencodeConfig.mcp["open-uitester-server"]).toEqual({
        type: "remote",
        url: "http://localhost:13000/mcp",
        enabled: true,
      });

      const piMcp = JSON.parse(readFileSync(join(projectFolder, ".pi", "mcp.json"), "utf8")) as {
        mcpServers: Record<string, { transport: string; url: string }>;
      };
      expect(piMcp.mcpServers["open-uitester-server"]).toEqual({
        transport: "streamable-http",
        url: "http://localhost:13000/mcp",
      });

      const codexAgents = JSON.parse(readFileSync(join(projectFolder, ".codex", "agents.json"), "utf8")) as {
        scope: string;
        agents: Record<string, boolean>;
        permissions: Record<string, boolean>;
        allowlistedCommands: string[];
      };
      expect(codexAgents.scope).toBe("project");
      expect(codexAgents.agents.codex).toBe(true);
      expect(codexAgents.permissions.inspect).toBe(true);
      expect(codexAgents.allowlistedCommands).toEqual(["hierarchy.query", "command.invoke"]);
    } finally {
      server.stop();
      rmSync(projectFolder, { recursive: true, force: true });
    }
  });

  it("persists global agent settings under the user home agent folders", async () => {
    const projectFolder = mkdtempSync(join(tmpdir(), "open-uitester-project-config-"));
    const userHomeFolder = mkdtempSync(join(tmpdir(), "open-uitester-home-config-"));
    const adapter = new CapturingAdapter();
    const server = await createUiTesterServer({ port: 0, adapter, projectFolder, userHomeFolder });
    try {
      const response = await adapter.fetchHandler?.(new Request("http://localhost/dashboard/agent-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "global",
          projectFolder,
          mcpEndpoint: "http://localhost:13000/mcp",
          agents: { codex: true, claude: true, gemini: true, cursor: true, opencode: true, pi: true },
          permissions: { inspect: true, commands: false },
          allowlistedCommands: ["scenes.query"],
        }),
      }));
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(200);

      const body = await (response as Response).json() as { paths?: Record<string, string> };
      expect(body.paths?.codexConfig).toBe(join(userHomeFolder, ".codex", "config.toml"));
      expect(body.paths?.codexMcp).toBe(join(userHomeFolder, ".codex", "mcp.json"));
      expect(body.paths?.codexAgents).toBe(join(userHomeFolder, ".codex", "agents.json"));
      expect(body.paths?.claudeMcp).toBe(join(userHomeFolder, ".claude.json"));
      expect(body.paths?.geminiSettings).toBe(join(userHomeFolder, ".gemini", "settings.json"));
      expect(body.paths?.cursorMcp).toBe(join(userHomeFolder, ".cursor", "mcp.json"));
      expect(body.paths?.opencodeConfig).toBe(join(userHomeFolder, ".config", "opencode", "opencode.json"));
      expect(body.paths?.piMcp).toBe(join(userHomeFolder, ".pi", "agent", "mcp.json"));
      expect(existsSync(join(projectFolder, ".codex", "mcp.json"))).toBe(false);
      expect(existsSync(join(projectFolder, ".codex", "config.toml"))).toBe(false);

      const codexAgents = JSON.parse(readFileSync(join(userHomeFolder, ".codex", "agents.json"), "utf8")) as {
        scope: string;
        projectFolder: string;
        allowlistedCommands: string[];
      };
      expect(codexAgents.scope).toBe("global");
      expect(codexAgents.projectFolder).toBe(projectFolder);
      expect(codexAgents.allowlistedCommands).toEqual(["scenes.query"]);
    } finally {
      server.stop();
      rmSync(projectFolder, { recursive: true, force: true });
      rmSync(userHomeFolder, { recursive: true, force: true });
    }
  });

  it("merges global agent settings into existing user config files", async () => {
    const projectFolder = mkdtempSync(join(tmpdir(), "open-uitester-project-merge-"));
    const userHomeFolder = mkdtempSync(join(tmpdir(), "open-uitester-home-merge-"));
    mkdirSync(join(userHomeFolder, ".codex"), { recursive: true });
    mkdirSync(join(userHomeFolder, ".cursor"), { recursive: true });
    mkdirSync(join(userHomeFolder, ".config", "opencode"), { recursive: true });
    writeFileSync(join(userHomeFolder, ".codex", "config.toml"), [
      'model = "gpt-5.4"',
      "",
      "[mcp_servers.open-uitester-server]",
      'url = "http://old/mcp"',
      "enabled = false",
      "",
      "[mcp_servers.existing]",
      'url = "http://existing/mcp"',
      "",
    ].join("\n"));
    writeFileSync(join(userHomeFolder, ".codex", "mcp.json"), JSON.stringify({
      mcpServers: {
        "existing-server": { command: "node", args: ["server.js"] },
        "open-uitester-server": { url: "http://old/mcp" },
      },
      customSetting: true,
    }, null, 2));
    writeFileSync(join(userHomeFolder, ".codex", "agents.json"), JSON.stringify({
      customAgentSetting: "keep",
      agents: { codex: false, existing: true },
      permissions: { existingPermission: true },
      allowlistedCommands: ["existing.command"],
    }, null, 2));
    writeFileSync(join(userHomeFolder, ".cursor", "mcp.json"), JSON.stringify({
      mcpServers: {
        existing: { url: "http://existing/mcp" },
      },
      cursorSetting: true,
    }, null, 2));
    writeFileSync(join(userHomeFolder, ".config", "opencode", "opencode.json"), JSON.stringify({
      "$schema": "https://opencode.ai/config.json",
      model: "anthropic/claude-sonnet-4-5",
      mcp: {
        existing: { type: "remote", url: "http://existing/mcp" },
      },
    }, null, 2));

    const adapter = new CapturingAdapter();
    const server = await createUiTesterServer({ port: 0, adapter, projectFolder, userHomeFolder });
    try {
      const response = await adapter.fetchHandler?.(new Request("http://localhost/dashboard/agent-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "global",
          projectFolder,
          mcpEndpoint: "http://localhost:13000/mcp",
          agents: { codex: true, cursor: true, opencode: true },
          permissions: { inspect: true },
          allowlistedCommands: ["scenes.query"],
        }),
      }));
      expect((response as Response).status).toBe(200);

      const codexConfig = readFileSync(join(userHomeFolder, ".codex", "config.toml"), "utf8");
      expect(codexConfig).toContain('model = "gpt-5.4"');
      expect(codexConfig).toContain("[mcp_servers.existing]");
      expect(codexConfig).toContain("[mcp_servers.open-uitester-server]");
      expect(codexConfig).toContain('url = "http://localhost:13000/mcp"');
      expect(codexConfig).toContain("enabled = true");
      expect(codexConfig).not.toContain("http://old/mcp");

      const codexMcp = JSON.parse(readFileSync(join(userHomeFolder, ".codex", "mcp.json"), "utf8")) as {
        mcpServers: Record<string, unknown>;
        customSetting?: boolean;
      };
      expect(codexMcp.customSetting).toBe(true);
      expect(codexMcp.mcpServers["existing-server"]).toEqual({ command: "node", args: ["server.js"] });
      expect(codexMcp.mcpServers["open-uitester-server"]).toEqual({ url: "http://localhost:13000/mcp" });

      const codexAgents = JSON.parse(readFileSync(join(userHomeFolder, ".codex", "agents.json"), "utf8")) as {
        customAgentSetting?: string;
        agents: Record<string, boolean>;
        permissions: Record<string, boolean>;
        allowlistedCommands: string[];
      };
      expect(codexAgents.customAgentSetting).toBe("keep");
      expect(codexAgents.agents.existing).toBe(true);
      expect(codexAgents.agents.codex).toBe(true);
      expect(codexAgents.permissions.existingPermission).toBe(true);
      expect(codexAgents.permissions.inspect).toBe(true);
      expect(codexAgents.allowlistedCommands).toEqual(["existing.command", "scenes.query"]);

      const cursorMcp = JSON.parse(readFileSync(join(userHomeFolder, ".cursor", "mcp.json"), "utf8")) as {
        mcpServers: Record<string, unknown>;
        cursorSetting?: boolean;
      };
      expect(cursorMcp.cursorSetting).toBe(true);
      expect(cursorMcp.mcpServers.existing).toEqual({ url: "http://existing/mcp" });
      expect(cursorMcp.mcpServers["open-uitester-server"]).toEqual({ url: "http://localhost:13000/mcp" });

      const opencodeConfig = JSON.parse(readFileSync(join(userHomeFolder, ".config", "opencode", "opencode.json"), "utf8")) as {
        model?: string;
        mcp: Record<string, unknown>;
      };
      expect(opencodeConfig.model).toBe("anthropic/claude-sonnet-4-5");
      expect(opencodeConfig.mcp.existing).toEqual({ type: "remote", url: "http://existing/mcp" });
      expect(opencodeConfig.mcp["open-uitester-server"]).toEqual({
        type: "remote",
        url: "http://localhost:13000/mcp",
        enabled: true,
      });
    } finally {
      server.stop();
      rmSync(projectFolder, { recursive: true, force: true });
      rmSync(userHomeFolder, { recursive: true, force: true });
    }
  });
});
