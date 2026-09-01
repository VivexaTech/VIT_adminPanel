import type { ProviderLiveStream, StreamConnectionState, StreamStatus } from "./types";

interface CloudflareLiveInput {
  uid: string;
  rtmps?: { url?: string; streamKey?: string };
  srt?: { url?: string; passphrase?: string };
  status?: unknown;
}

interface CloudflareVideo {
  uid: string;
  readyToStream?: boolean;
  status?: { state?: string };
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function accountId(): string {
  return requiredEnv("CLOUDFLARE_ACCOUNT_ID");
}

function apiToken(): string {
  return process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim() || requiredEnv("CLOUDFLARE_API_TOKEN");
}

function allowedOrigins(): string[] {
  const configured = process.env.CLOUDFLARE_STREAM_ALLOWED_ORIGINS?.split(",").map((item) => item.trim()).filter(Boolean);
  if (configured?.length) return configured;
  return ["vit.vivexatech.in", "vitpanel.vivexatech.in", "localhost", "127.0.0.1"];
}

async function cf<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const body = (await response.json()) as { success?: boolean; result?: T; errors?: Array<{ message?: string }> };
  if (!response.ok || body.success === false) {
    throw new Error(body.errors?.[0]?.message || `Cloudflare Stream request failed (${response.status})`);
  }
  return body.result as T;
}

function connectionFromStatus(status: unknown): StreamConnectionState {
  if (!status) return "disconnected";
  let parsed: { current?: { state?: string } } | string = status as { current?: { state?: string } } | string;
  if (typeof status === "string") {
    const trimmed = status.trim();
    if (trimmed.startsWith("{")) {
      try {
        parsed = JSON.parse(trimmed) as { current?: { state?: string } };
      } catch {
        parsed = trimmed;
      }
    } else {
      parsed = trimmed;
    }
  }
  const state = typeof parsed === "string" ? parsed : String(parsed.current?.state ?? "");
  if (state === "connected" || state === "reconnected") return "connected";
  if (state === "failed_to_connect" || state === "failed_to_reconnect" || state === "errored") return "error";
  return "disconnected";
}

function toProviderStream(input: CloudflareLiveInput): ProviderLiveStream {
  return {
    provider: "cloudflare",
    streamId: input.uid,
    ingestUrl: input.rtmps?.url || "rtmps://live.cloudflare.com:443/live/",
    streamKey: input.rtmps?.streamKey || "",
    srtUrl: input.srt?.url,
    srtPassphrase: input.srt?.passphrase,
  };
}

export function isCloudflareConfigured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
      (process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN)
  );
}

export async function createLiveStream(input: { liveClassId: string; title: string; recordingEnabled: boolean }): Promise<ProviderLiveStream> {
  const created = await cf<CloudflareLiveInput>("/stream/live_inputs", {
    method: "POST",
    body: JSON.stringify({
      meta: { name: input.title, liveClassId: input.liveClassId },
      recording: {
        mode: input.recordingEnabled ? "automatic" : "off",
        requireSignedURLs: true,
        allowedOrigins: allowedOrigins(),
        hideLiveViewerCount: true,
        timeoutSeconds: 30,
      },
    }),
  });
  return toProviderStream(created);
}

export async function getStreamIngestDetails(streamId: string): Promise<ProviderLiveStream> {
  return toProviderStream(await cf<CloudflareLiveInput>(`/stream/live_inputs/${streamId}`));
}

export async function getStreamStatus(streamId: string): Promise<StreamStatus> {
  const live = await cf<CloudflareLiveInput>(`/stream/live_inputs/${streamId}`);
  const connection = connectionFromStatus(live.status);
  let recordingId: string | undefined;
  let recordingReady = false;
  let recordingFailed = false;
  try {
    const videos = await cf<CloudflareVideo[]>(`/stream?liveInput=${encodeURIComponent(streamId)}`);
    const latest = Array.isArray(videos) ? videos[0] : undefined;
    if (latest) {
      recordingId = latest.uid;
      recordingReady = Boolean(latest.readyToStream || latest.status?.state === "ready");
      recordingFailed = latest.status?.state === "error";
    }
  } catch {
    // Live status is still useful.
  }
  return { connection, isLive: connection === "connected", recordingReady, recordingId, recordingFailed };
}

export async function endLiveStream(streamId: string): Promise<void> {
  await cf(`/stream/live_inputs/${streamId}`, {
    method: "PUT",
    body: JSON.stringify({ uid: streamId, recording: { timeoutSeconds: 0 } }),
  }).catch(() => undefined);
}
