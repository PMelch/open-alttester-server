import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dashboardHtml = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../dashboard.html"),
  "utf8",
);

describe("Dashboard agent configuration panel", () => {
  it("exposes option 4 as a gear-opened MCP client configuration panel", () => {
    expect(dashboardHtml).toContain('aria-label="Configure agents"');
    expect(dashboardHtml).toContain('aria-label="Agent configuration panel"');
    expect(dashboardHtml).toContain("agentConfigOpen");
    expect(dashboardHtml).toContain("agentConfigScope");
    expect(dashboardHtml).toContain("Project Folder");
    expect(dashboardHtml).toContain("Global Defaults");
    expect(dashboardHtml).toContain("Enabled Agents");
    expect(dashboardHtml).toContain("Allowlisted Commands");
    expect(dashboardHtml).toContain("chooseAgentProjectFolder");
    expect(dashboardHtml).toContain("handleAgentProjectFolderPicked");
    expect(dashboardHtml).toContain("showDirectoryPicker");
    expect(dashboardHtml).toContain("webkitdirectory");
    expect(dashboardHtml).toContain("state.projectFolder");
    expect(dashboardHtml).toContain("Manual MCP Configs");
    expect(dashboardHtml).toContain("manualMcpConfig");
    expect(dashboardHtml).toContain("savedMcpConfigSummary");
    expect(dashboardHtml).toContain("mcpServers");
    expect(dashboardHtml).toContain("open-uitester-server");
    expect(dashboardHtml).toContain("Codex");
    expect(dashboardHtml).toContain("Claude");
    expect(dashboardHtml).toContain("Gemini");
    expect(dashboardHtml).toContain("Cursor");
    expect(dashboardHtml).toContain("OpenCode");
    expect(dashboardHtml).toContain("Pi");
    expect(dashboardHtml).toContain("copyManualMcpConfig");
    expect(dashboardHtml).toContain("saveAgentConfig");
    expect(dashboardHtml).toContain("resetAgentConfig");
    expect(dashboardHtml).toContain("/dashboard/agent-config");
    expect(dashboardHtml).toContain(".codex/config.toml");
    expect(dashboardHtml).toContain(".codex/mcp.json");
    expect(dashboardHtml).toContain("~/.claude.json");
    expect(dashboardHtml).toContain(".gemini/settings.json");
    expect(dashboardHtml).toContain(".cursor/mcp.json");
    expect(dashboardHtml).toContain("opencode.json");
    expect(dashboardHtml).toContain(".pi/mcp.json");
    expect(dashboardHtml).not.toContain("localStorage");
    expect(dashboardHtml.indexOf("Tool Catalog")).toBeGreaterThan(dashboardHtml.indexOf("activeTab === 'mcp'"));
    expect(dashboardHtml.indexOf("Tool Catalog")).toBeLessThan(dashboardHtml.indexOf('aria-label="Debug command stream"'));
  });
});
