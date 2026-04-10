import type { ConnectionRegistry } from "../server/registry";
import type { InspectorService } from "../server/inspector";

export async function handleInspectorRequest(
  req: Request,
  registry: ConnectionRegistry,
  inspector: InspectorService,
): Promise<Response | null> {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/inspector\/([^/]+)(\/objects)?$/);
  if (!match) return null;

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json; charset=utf-8", "Allow": "GET" },
    });
  }

  const appName = decodeURIComponent(match[1]);
  const isObjects = !!match[2];

  const appWs = registry.getApp(appName);
  if (!appWs) {
    return new Response(JSON.stringify({ error: `No app connected with appName "${appName}"` }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  try {
    if (isObjects) {
      const objects = await inspector.send(appWs, "findObjects", {
        by: "PATH",
        value: "//*",
        cameraBy: "NAME",
        cameraValue: "",
        enabled: true,
      }, 10_000); // large scenes can take longer to serialise
      return new Response(JSON.stringify({ objects }), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const [rawScenes, currentScene] = await Promise.all([
      inspector.send(appWs, "getAllLoadedScenes", {}),
      inspector.send(appWs, "getCurrentScene", {}),
    ]);
    // Normalise: Unity may return a single string when only one scene is loaded
    const scenes = Array.isArray(rawScenes) ? rawScenes : rawScenes != null ? [rawScenes] : [];
    return new Response(JSON.stringify({ scenes, currentScene }), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}
