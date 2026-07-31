export type InlineYouTubePlaybackStatus = "loading" | "ready" | "error";

export function shouldArmStuckLoadTimeout(status: InlineYouTubePlaybackStatus) {
  return status === "loading";
}
