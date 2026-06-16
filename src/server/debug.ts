import type { DriverMeta } from "./registry";

export type CommandDebugSourceType = "driver" | "skill" | "mcp";
export type CommandDebugStatus = "pending" | "ok" | "error" | "rejected" | "timeout";

export interface CommandDebugSource {
  type: CommandDebugSourceType;
  label: string;
  detail?: string;
}

export interface CommandDebugEvent {
  id: string;
  time: string;
  updatedAt: string;
  appName: string;
  source: CommandDebugSource;
  commandName: string;
  toolName?: string;
  messageId?: string;
  status: CommandDebugStatus;
  durationMs?: number;
  requestPayload?: unknown;
  responsePayload?: unknown;
  error?: string;
}

export interface CommandDebugState {
  commands: CommandDebugEvent[];
  sources: CommandDebugSource[];
  errorCount: number;
}

export interface CommandDebugRequest {
  appName: string;
  source: CommandDebugSource;
  commandName: string;
  toolName?: string;
  messageId?: string;
  requestPayload?: unknown;
}

export interface CommandDebugCompletion {
  responsePayload?: unknown;
  status?: CommandDebugStatus;
  durationMs?: number;
  error?: string;
}

export interface CommandEnvelope {
  commandName: string;
  messageId?: string;
  payload: Record<string, unknown>;
}

const MAX_EVENTS = 200;

export class CommandDebugLog {
  private commands: CommandDebugEvent[] = [];
  private pendingByMessage = new Map<string, string>();
  private counter = 0;

  constructor(private readonly onChange?: (event: CommandDebugEvent) => void) {}

  recordRequest(input: CommandDebugRequest): CommandDebugEvent {
    const now = new Date().toISOString();
    const event: CommandDebugEvent = {
      id: `debug-${++this.counter}`,
      time: now,
      updatedAt: now,
      appName: input.appName,
      source: input.source,
      commandName: input.commandName,
      toolName: input.toolName,
      messageId: input.messageId,
      status: "pending",
      requestPayload: input.requestPayload,
    };

    this.commands.unshift(event);
    if (input.messageId) {
      this.pendingByMessage.set(messageKey(input.appName, input.messageId), event.id);
    }
    this.trim();
    this.emit(event);
    return event;
  }

  recordCompletion(id: string, completion: CommandDebugCompletion): CommandDebugEvent | undefined {
    const event = this.commands.find(command => command.id === id);
    if (!event) return undefined;

    event.status = completion.status ?? (completion.error ? "error" : "ok");
    event.updatedAt = new Date().toISOString();
    event.durationMs = completion.durationMs;
    event.responsePayload = completion.responsePayload;
    event.error = completion.error;
    if (event.messageId) {
      this.pendingByMessage.delete(messageKey(event.appName, event.messageId));
    }
    this.emit(event);
    return event;
  }

  recordResponse(appName: string, messageId: string, responsePayload: unknown): CommandDebugEvent | undefined {
    const id = this.pendingByMessage.get(messageKey(appName, messageId));
    if (!id) return undefined;
    const event = this.commands.find(command => command.id === id);
    const durationMs = event ? Date.now() - Date.parse(event.time) : undefined;
    const status = responseHasError(responsePayload) ? "error" : "ok";
    const error = responseErrorMessage(responsePayload);
    return this.recordCompletion(id, { responsePayload, durationMs, status, error });
  }

  state(): CommandDebugState {
    return {
      commands: this.commands.map(command => ({ ...command, source: { ...command.source } })),
      sources: uniqueSources(this.commands.map(command => command.source)),
      errorCount: this.commands.filter(command =>
        command.status === "error" || command.status === "rejected" || command.status === "timeout"
      ).length,
    };
  }

  private trim(): void {
    if (this.commands.length <= MAX_EVENTS) return;
    const removed = this.commands.splice(MAX_EVENTS);
    for (const event of removed) {
      if (event.messageId) {
        this.pendingByMessage.delete(messageKey(event.appName, event.messageId));
      }
    }
  }

  private emit(event: CommandDebugEvent): void {
    this.onChange?.({ ...event, source: { ...event.source } });
  }
}

export function parseCommandEnvelope(raw: string): CommandEnvelope | null {
  try {
    const payload = JSON.parse(raw) as unknown;
    if (!isRecord(payload) || typeof payload.commandName !== "string") return null;
    return {
      commandName: payload.commandName,
      messageId: typeof payload.messageId === "string" ? payload.messageId : undefined,
      payload,
    };
  } catch {
    return null;
  }
}

export function sourceFromDriver(meta: Pick<DriverMeta, "driverType" | "platform" | "deviceInstanceId">): CommandDebugSource {
  const label = meta.driverType || "unknown";
  return {
    type: label.toLowerCase().includes("skill") ? "skill" : "driver",
    label,
    detail: `${meta.platform || "unknown"} · ${meta.deviceInstanceId || "unknown"}`,
  };
}

export const MCP_DEBUG_SOURCE: CommandDebugSource = {
  type: "mcp",
  label: "MCP agent",
};

function messageKey(appName: string, messageId: string): string {
  return `${appName}\0${messageId}`;
}

function uniqueSources(sources: CommandDebugSource[]): CommandDebugSource[] {
  const seen = new Set<string>();
  const unique: CommandDebugSource[] = [];
  for (const source of sources) {
    const key = `${source.type}\0${source.label}\0${source.detail ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...source });
  }
  return unique;
}

function responseHasError(payload: unknown): boolean {
  return isRecord(payload) && payload.error != null;
}

function responseErrorMessage(payload: unknown): string | undefined {
  if (!isRecord(payload) || payload.error == null) return undefined;
  if (isRecord(payload.error) && typeof payload.error.message === "string") return payload.error.message;
  return String(payload.error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
