/**
 * BDD tests for the web dashboard (Vue 3 + Tailwind, served as static HTML).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createUiTesterServer, type UiTesterServer } from "../../server/server";

const { version: PACKAGE_VERSION } = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../package.json"), "utf8"),
) as { version: string };

describe("Feature: Web dashboard", () => {
  let srv: UiTesterServer;

  beforeEach(async () => {
    srv = await createUiTesterServer({ port: 0 });
  });

  afterEach(() => {
    srv.stop();
  });

  // ------------------------------------------------------------------ scenarios

  describe("Scenario: Dashboard HTML served at root", () => {
    it("Given the server is running / When GET / is requested / Then it returns HTML with status 200", async () => {
      const res = await fetch(`http://127.0.0.1:${srv.port}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/text\/html/);
      const html = await res.text();
      expect(html).toContain("<html");
      expect(html).toContain("UiTester");
      expect(html).toContain("vue");
      expect(html).toContain("tailwind");
    });
  });

  describe("Scenario: Dashboard HTML contains version display binding", () => {
    it("Given the server is running / When GET / is requested / Then the HTML includes the version template binding", async () => {
      const res = await fetch(`http://127.0.0.1:${srv.port}/`);
      const html = await res.text();
      expect(html).toContain("state.version");
    });
  });

  describe("Scenario: Dashboard exposes professional operations landmarks", () => {
    it("Given the server is running / When GET / is requested / Then the redesigned UI has named regions for status, inventory, events, and inspector controls", async () => {
      const res = await fetch(`http://127.0.0.1:${srv.port}/`);
      const html = await res.text();

      expect(html).toContain('aria-label="Dashboard sections"');
      expect(html).toContain("Live Dashboard");
      expect(html).toContain("Inspector");
      expect(html).toContain("MCP");
      expect(html).toContain("Debug");
      expect(html).toContain('aria-label="Server status"');
      expect(html).toContain('aria-label="Connection inventory"');
      expect(html).toContain('aria-label="Recent events"');
      expect(html).toContain('aria-label="Inspector controls"');
    });
  });

  describe("Scenario: Dashboard derives WebSocket endpoint from the served host", () => {
    it("Given the server can run on any port / When GET / is requested / Then the HTML does not hard-code the default endpoint", async () => {
      const res = await fetch(`http://127.0.0.1:${srv.port}/`);
      const html = await res.text();

      expect(html).toContain("websocketEndpoint");
      expect(html).not.toContain("ws://127.0.0.1:13000");
    });
  });

  describe("Scenario: Dashboard omits redundant section navigation and explanatory copy", () => {
    it("Given the server is running / When GET / is requested / Then the UI does not render the removed section rail or triage explanation panel", async () => {
      const res = await fetch(`http://127.0.0.1:${srv.port}/`);
      const html = await res.text();

      expect(html).not.toContain('href="#server-status"');
      expect(html).not.toContain("Triage Focus");
    });
  });

  describe("Scenario: Dashboard reserves a full-height inspector workspace on wide screens", () => {
    it("Given the server is running / When GET / is requested / Then the desktop layout separates the live workspace from the inspector tab", async () => {
      const res = await fetch(`http://127.0.0.1:${srv.port}/`);
      const html = await res.text();

      expect(html).toContain('aria-label="Live dashboard workspace"');
      expect(html).toContain('aria-label="Inspector workspace"');
      expect(html).toContain("activeTab === 'inspector'");
    });
  });

  describe("Scenario: Inspector overflow does not stretch the primary workspace", () => {
    it("Given the inspector renders a long hierarchy / When the desktop grid lays out the columns / Then the primary workspace keeps its own height", async () => {
      const res = await fetch(`http://127.0.0.1:${srv.port}/`);
      const html = await res.text();

      expect(html).toContain('aria-label="Live dashboard workspace"');
      expect(html).toContain('class="grid min-h-0 min-w-0 self-start gap-4"');
    });
  });

  describe("Scenario: Inspector filters the object tree by fuzzy node name", () => {
    it("Given the dashboard loads / When the inspector is rendered / Then it exposes a persistent object filter with a clear control", async () => {
      const res = await fetch(`http://127.0.0.1:${srv.port}/`);
      const html = await res.text();

      expect(html).toContain('aria-label="Filter object tree"');
      expect(html).toContain('aria-label="Clear object filter"');
      expect(html).toContain('v-model="objectFilter"');
      expect(html).toContain("filteredFlatObjects");
    });

    it("Given a user enters an abbreviated name / When fuzzy matching runs / Then matching is case-insensitive and ordered by node-name characters", async () => {
      const res = await fetch(`http://127.0.0.1:${srv.port}/`);
      const html = await res.text();
      const fuzzyNodeNameMatches = extractDashboardFunction<(nodeName: string, query: string) => boolean>(
        html,
        "fuzzyNodeNameMatches",
      );

      expect(fuzzyNodeNameMatches("PlayButton", "plbtn")).toBe(true);
      expect(fuzzyNodeNameMatches("Main Camera", "mc")).toBe(true);
      expect(fuzzyNodeNameMatches("Main Camera", "CAM")).toBe(true);
      expect(fuzzyNodeNameMatches("EnemyRoot", "cam")).toBe(false);
      expect(fuzzyNodeNameMatches("Canvas", "")).toBe(true);
    });
  });

  describe("Scenario: Dashboard exposes MCP server controls", () => {
    it("Given the dashboard loads / When MCP support is available / Then the UI exposes mode controls, enabled apps, and tool catalog on the MCP tab", async () => {
      const res = await fetch(`http://127.0.0.1:${srv.port}/`);
      const html = await res.text();

      expect(html).toContain("activeTab === 'mcp'");
      expect(html).toContain('aria-label="MCP server controls"');
      expect(html).toContain("/dashboard/mcp");
      expect(html).toContain("mcpMode");
      expect(html).toContain("toggleMcpApp");
      expect(html).toContain("Tool Catalog");
    });
  });

  describe("Scenario: Dashboard hides agent configuration behind the MCP gear", () => {
    it("Given the dashboard loads / When option 4 is implemented / Then the UI exposes scoped agent settings and a manual MCP config block", async () => {
      const res = await fetch(`http://127.0.0.1:${srv.port}/`);
      const html = await res.text();

      expect(html).toContain('aria-label="Configure agents"');
      expect(html).toContain('aria-label="Agent configuration panel"');
      expect(html).toContain("agentConfigOpen");
      expect(html).toContain("agentConfigScope");
      expect(html).toContain("Project Folder");
      expect(html).toContain("Global Defaults");
      expect(html).toContain("Enabled Agents");
      expect(html).toContain("Allowlisted Commands");
      expect(html).toContain("chooseAgentProjectFolder");
      expect(html).toContain("handleAgentProjectFolderPicked");
      expect(html).toContain("showDirectoryPicker");
      expect(html).toContain("webkitdirectory");
      expect(html).toContain("state.projectFolder");
      expect(html).toContain("Manual MCP Configs");
      expect(html).toContain("manualMcpConfig");
      expect(html).toContain("savedMcpConfigSummary");
      expect(html).toContain("mcpServers");
      expect(html).toContain("open-uitester-server");
      expect(html).toContain("Codex");
      expect(html).toContain("Claude");
      expect(html).toContain("Gemini");
      expect(html).toContain("Cursor");
      expect(html).toContain("OpenCode");
      expect(html).toContain("Pi");
      expect(html).toContain("copyManualMcpConfig");
      expect(html).toContain("saveAgentConfig");
      expect(html).toContain("resetAgentConfig");
      expect(html).toContain("/dashboard/agent-config");
      expect(html).toContain(".codex/config.toml");
      expect(html).toContain(".codex/mcp.json");
      expect(html).toContain("~/.claude.json");
      expect(html).toContain(".gemini/settings.json");
      expect(html).toContain(".cursor/mcp.json");
      expect(html).toContain("opencode.json");
      expect(html).toContain(".pi/mcp.json");
      expect(html).not.toContain("localStorage");
    });
  });

  describe("Scenario: Dashboard exposes command debug tooling", () => {
    it("Given the dashboard loads / When command debug support is available / Then the UI exposes a Debug tab with request and response details", async () => {
      const res = await fetch(`http://127.0.0.1:${srv.port}/`);
      const html = await res.text();

      expect(html).toContain("activeTab === 'debug'");
      expect(html).toContain('aria-label="Debug command stream"');
      expect(html).toContain("Command Sources");
      expect(html).toContain("Received Commands");
      expect(html).toContain('aria-label="Scrollable debug command events"');
      expect(html).toContain("max-h-52 overflow-auto");
      expect(html).toContain("sticky top-0");
      expect(html).toContain("Request Payload");
      expect(html).toContain("Response Payload");
      expect(html).toContain("selectedDebugCommand");
    });
  });

  describe("Scenario: State endpoint returns current connection counts", () => {
    it("Given a Unity app is connected / When GET /dashboard/state is requested / Then JSON reflects the live count", async () => {
      const app = new WebSocket(appUrl(srv.port, "StatGame"));
      await wsOpen(app);

      const res = await fetch(`http://127.0.0.1:${srv.port}/dashboard/state`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/application\/json/);
      const body = await res.json() as { apps: unknown[]; drivers: unknown[]; uptime: number; version: string };
      expect(body.apps).toHaveLength(1);
      expect(body.drivers).toHaveLength(0);
      expect(typeof body.uptime).toBe("number");
      expect(body.version).toBe(PACKAGE_VERSION);

      app.close();
    });
  });

  describe("Scenario: Dashboard debug state records test driver commands", () => {
    it("Given a paired session / When a test driver sends a command and the app responds / Then dashboard state includes request and response payloads", async () => {
      const appMessages: string[] = [];
      const driverMessages: string[] = [];
      const app = new WebSocket(appUrl(srv.port, "DebugGame"));
      app.addEventListener("message", e => appMessages.push(e.data as string));
      await wsOpen(app);

      const driver = new WebSocket(driverUrl(srv.port, "DebugGame"));
      driver.addEventListener("message", e => driverMessages.push(e.data as string));
      await wsOpen(driver);

      const command = JSON.stringify({ commandName: "getCurrentScene", messageId: "debug-1", data: "{}" });
      driver.send(command);
      await waitForCondition(() => appMessages.includes(command), 1000);

      const response = JSON.stringify({ commandName: "getCurrentScene", messageId: "debug-1", data: '{"name":"DebugScene"}' });
      app.send(response);
      await waitForCondition(() => driverMessages.includes(response), 1000);

      const state = await debugState(srv.port);
      const event = state.commands.find(commandEvent => commandEvent.messageId === "debug-1");
      expect(event).toMatchObject({
        appName: "DebugGame",
        commandName: "getCurrentScene",
        source: { type: "driver", label: "python_3.5.0" },
        status: "ok",
      });
      expect(event?.requestPayload).toEqual(JSON.parse(command));
      expect(event?.responsePayload).toEqual(JSON.parse(response));

      app.close();
      driver.close();
    });
  });

  describe("Scenario: SSE feed emits appConnected event", () => {
    it("Given an SSE subscriber / When a Unity app connects / Then an appConnected event is received", async () => {
      // Wait for the server's initial keepalive before connecting the WebSocket.
      // The server enqueues ": keepalive" synchronously on subscribe(), flushing
      // headers immediately. Waiting for it guarantees the SSE reader is active
      // before we trigger the appConnected event.
      const { lines, cancel } = openSseStreamRaw(srv.port, "/dashboard/events");
      try {
        await waitForRawLine(lines, ": keepalive", 500);

        const app = new WebSocket(appUrl(srv.port, "LiveGame"));
        await wsOpen(app);

        await waitForRawLine(lines, "event: appConnected", 2000);
        expect(lines.some(l => l.includes("LiveGame"))).toBe(true);

        app.close();
      } finally {
        cancel();
      }
    });
  });

  describe("Scenario: SSE feed emits appDisconnected event", () => {
    it("Given a connected app / When it disconnects / Then an appDisconnected event is received", async () => {
      const app = new WebSocket(appUrl(srv.port, "GoneGame"));
      await wsOpen(app);

      const { events, cancel } = openSseStream(srv.port, "/dashboard/events");
      try {
        await waitMs(30);

        app.close();
        await waitForEvent(events, "appDisconnected", 2000);
        expect(events.some(e => e.event === "appDisconnected" && e.data.includes("GoneGame"))).toBe(true);
      } finally {
        cancel();
      }
    });
  });

  describe("Scenario: SSE feed emits driverConnected event", () => {
    it("Given a paired session / When a driver connects / Then a driverConnected event is received", async () => {
      const app = new WebSocket(appUrl(srv.port, "DriverGame"));
      await wsOpen(app);
      await waitMs(30);

      const { events, cancel } = openSseStream(srv.port, "/dashboard/events");
      try {
        await waitMs(30);

        const driver = new WebSocket(driverUrl(srv.port, "DriverGame"));
        await wsOpen(driver);

        await waitForEvent(events, "driverConnected", 2000);
        expect(events.some(e => e.event === "driverConnected" && e.data.includes("DriverGame"))).toBe(true);

        app.close();
        driver.close();
      } finally {
        cancel();
      }
    });
  });
  describe("Scenario: SSE heartbeat keeps connection alive", () => {
    it("Given an SSE subscriber / When no events are emitted / Then a keepalive comment arrives within the heartbeat interval", async () => {
      const heartbeatSrv = await createUiTesterServer({ port: 0, heartbeatMs: 100 });
      try {
        const { lines, cancel } = openSseStreamRaw(heartbeatSrv.port, "/dashboard/events");
        await waitForRawLine(lines, ": keepalive", 500);
        expect(lines.some(l => l.startsWith(": keepalive"))).toBe(true);
        cancel();
      } finally {
        heartbeatSrv.stop();
      }
    });
  });

  describe("Scenario: SSE feed emits driverDisconnected event", () => {
    it("Given a paired session / When the driver disconnects / Then a driverDisconnected event is received", async () => {
      const app = new WebSocket(appUrl(srv.port, "DiscoDriver"));
      await wsOpen(app);
      await waitMs(30);

      const driver = new WebSocket(driverUrl(srv.port, "DiscoDriver"));
      await wsOpen(driver);
      await waitMs(30);

      const { events, cancel } = openSseStream(srv.port, "/dashboard/events");
      try {
        await waitMs(30);

        driver.close();
        await waitForEvent(events, "driverDisconnected", 2000);
        expect(events.some(e => e.event === "driverDisconnected" && e.data.includes("DiscoDriver"))).toBe(true);

        app.close();
      } finally {
        cancel();
      }
    });
  });
});

// ------------------------------------------------------------------ utilities

function appUrl(port: number, appName: string): string {
  return `ws://127.0.0.1:${port}/altws/app?appName=${appName}&platform=Editor&platformVersion=6000&deviceInstanceId=app-1&driverType=SDK`;
}

function driverUrl(port: number, appName: string): string {
  return `ws://127.0.0.1:${port}/altws?appName=${appName}&platform=unknown&platformVersion=unknown&deviceInstanceId=d1&driverType=python_3.5.0`;
}

function wsOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) return resolve();
    ws.onopen = () => resolve();
    ws.onerror = (e) => reject(e);
  });
}

interface SseEvent { event: string; data: string }

interface DebugCommandEvent {
  messageId: string;
  appName: string;
  commandName: string;
  source: { type: string; label: string };
  status: string;
  requestPayload?: unknown;
  responsePayload?: unknown;
}

interface DebugState {
  commands: DebugCommandEvent[];
}

async function debugState(port: number): Promise<DebugState> {
  const body = await fetch(`http://127.0.0.1:${port}/dashboard/state`).then(r => r.json()) as {
    debug?: DebugState;
  };
  return body.debug ?? { commands: [] };
}

function openSseStream(port: number, path: string): { events: SseEvent[]; cancel: () => void } {
  const events: SseEvent[] = [];
  const ctrl = new AbortController();

  fetch(`http://127.0.0.1:${port}${path}`, {
    headers: { Accept: "text/event-stream" },
    signal: ctrl.signal,
  }).then(async (res) => {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        const ev = parseSseBlock(part);
        if (ev) events.push(ev);
      }
    }
  }).catch(() => {});

  return {
    events,
    cancel: () => ctrl.abort(),
  };
}

function parseSseBlock(block: string): SseEvent | null {
  let event = "message", data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7).trim();
    if (line.startsWith("data: ")) data = line.slice(6).trim();
  }
  return data ? { event, data } : null;
}

function waitForEvent(events: SseEvent[], type: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (events.some(e => e.event === type)) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error(`Timed out waiting for SSE event: ${type}`));
      setTimeout(check, 20);
    };
    check();
  });
}

function waitForCondition(fn: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (fn()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("Timed out waiting for condition"));
      setTimeout(check, 20);
    };
    check();
  });
}

function waitMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function openSseStreamRaw(port: number, path: string): { lines: string[]; cancel: () => void } {
  const lines: string[] = [];
  const ctrl = new AbortController();

  fetch(`http://127.0.0.1:${port}${path}`, {
    headers: { Accept: "text/event-stream" },
    signal: ctrl.signal,
  }).then(async (res) => {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n");
      buf = parts.pop() ?? "";
      for (const line of parts) {
        if (line.length > 0) lines.push(line);
      }
    }
  }).catch(() => {});

  return { lines, cancel: () => ctrl.abort() };
}

function waitForRawLine(lines: string[], prefix: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (lines.some(l => l.startsWith(prefix))) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error(`Timed out waiting for SSE line: ${prefix}`));
      setTimeout(check, 20);
    };
    check();
  });
}

function extractDashboardFunction<T extends (...args: never[]) => unknown>(html: string, name: string): T {
  const functionStart = html.indexOf(`function ${name}`);
  if (functionStart === -1) {
    throw new Error(`Function ${name} not found in dashboard HTML`);
  }

  const bodyStart = html.indexOf("{", functionStart);
  if (bodyStart === -1) {
    throw new Error(`Function ${name} has no body`);
  }

  let depth = 0;
  for (let i = bodyStart; i < html.length; i += 1) {
    if (html[i] === "{") depth += 1;
    if (html[i] === "}") depth -= 1;
    if (depth === 0) {
      const source = html.slice(functionStart, i + 1);
      return new Function(`${source}; return ${name};`)() as T;
    }
  }

  throw new Error(`Function ${name} body was not closed`);
}
