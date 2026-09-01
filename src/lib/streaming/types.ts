export type StreamConnectionState = "unknown" | "connected" | "disconnected" | "error";

export interface ProviderLiveStream {
  provider: "cloudflare";
  streamId: string;
  ingestUrl: string;
  streamKey: string;
  srtUrl?: string;
  srtPassphrase?: string;
}

export interface StreamStatus {
  connection: StreamConnectionState;
  isLive: boolean;
  recordingReady: boolean;
  recordingId?: string;
  recordingFailed?: boolean;
}
