"use client";

import {
    type SyntheticEvent,
    useEffect,
    useReducer,
    useRef,
    useState,
} from "react";
import ReactPlayer from "react-player";
import {
    ExternalLink,
    Loader2,
    Pause,
    Play,
    RotateCcw,
    TriangleAlert,
    Volume1,
    Volume2,
    VolumeX,
} from "lucide-react";
import {
    type InlineYouTubePlaybackStatus,
    shouldArmStuckLoadTimeout,
} from "@/lib/media/inline-youtube-watchdog";
import { cn } from "@/lib/utils";

// If the player never becomes ready for this long we assume the embed is wedged
// and surface a recoverable error state instead of a perpetual black screen.
const STUCK_TIMEOUT_MS = 20000;

type InlineYouTubePlayerProps = {
    videoId: string;
    title?: string;
    autoplay?: boolean;
};

type PlaybackStatus = InlineYouTubePlaybackStatus;

type PlayerState = {
    currentTime: number;
    duration: number;
    isBuffering: boolean;
    isMuted: boolean;
    isPlaying: boolean;
    playbackSpeed: number;
    progress: number;
    showControls: boolean;
    status: PlaybackStatus;
    useNativeControls: boolean;
    volume: number;
};

type PlayerAction =
    | { type: "playing"; playing: boolean }
    | { type: "volume"; volume: number }
    | { type: "mute"; muted: boolean }
    | { type: "progress"; currentTime: number; progress: number }
    | { type: "seek"; currentTime: number; progress: number }
    | { type: "duration"; duration: number }
    | { type: "speed"; speed: number }
    | { type: "controls"; show: boolean }
    | { type: "native-controls"; enabled: boolean }
    | { type: "ready" }
    | { type: "buffering"; buffering: boolean }
    | { type: "error" }
    | { type: "reload"; playing: boolean };

function createInitialPlayerState(): PlayerState {
    return {
        currentTime: 0,
        duration: 0,
        isBuffering: false,
        isMuted: false,
        // Never assume playback before the embed reports it. Seeding this from
        // `autoplay` made the overlay render "Pause" for a video that hadn't
        // started (YouTube blocks unmuted autoplay), so the first click paused
        // nothing and desynced the button. Autoplay intent is applied on ready.
        isPlaying: false,
        playbackSpeed: 1,
        progress: 0,
        showControls: false,
        status: "loading",
        useNativeControls: false,
        volume: 1,
    };
}

function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
    switch (action.type) {
        case "playing":
            return { ...state, isPlaying: action.playing };
        case "volume":
            return {
                ...state,
                isMuted: action.volume === 0,
                volume: action.volume,
            };
        case "mute":
            return { ...state, isMuted: action.muted };
        case "progress":
            return {
                ...state,
                currentTime: action.currentTime,
                progress: action.progress,
            };
        case "seek":
            return {
                ...state,
                currentTime: action.currentTime,
                progress: action.progress,
            };
        case "duration":
            return { ...state, duration: action.duration };
        case "speed":
            return { ...state, playbackSpeed: action.speed };
        case "controls":
            return { ...state, showControls: action.show };
        case "native-controls":
            return { ...state, useNativeControls: action.enabled };
        case "ready":
            // A successful (re)load clears any prior error and stops buffering.
            return { ...state, status: "ready", isBuffering: false };
        case "buffering":
            // Ignore buffering signals once we've given up on the embed.
            if (state.status === "error") {
                return state;
            }
            return { ...state, isBuffering: action.buffering };
        case "error":
            return { ...state, status: "error", isBuffering: false, isPlaying: false };
        case "reload":
            // Retry: drop back to a clean loading state for the fresh iframe.
            return {
                ...state,
                status: "loading",
                isBuffering: false,
                isPlaying: action.playing,
                currentTime: 0,
                progress: 0,
            };
    }
}

function formatTime(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return "0:00";
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function clampPercentage(value: number) {
    return Math.min(Math.max(value, 0), 100);
}

function Slider({
    value,
    onChange,
    className,
    ariaLabel,
}: {
    value: number;
    onChange: (value: number) => void;
    className?: string;
    ariaLabel: string;
}) {
    const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const percentage = ((event.clientX - rect.left) / rect.width) * 100;
        onChange(clampPercentage(percentage));
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            onChange(clampPercentage(value - 5));
        }

        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            onChange(clampPercentage(value + 5));
        }

        if (event.key === "Home") {
            event.preventDefault();
            onChange(0);
        }

        if (event.key === "End") {
            event.preventDefault();
            onChange(100);
        }
    };

    const safeValue = clampPercentage(value);

    return (
        <div
            role="slider"
            tabIndex={0}
            aria-label={ariaLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(safeValue)}
            className={cn(
                "relative h-1.5 w-full cursor-pointer rounded-full bg-white/20 outline-none transition focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/80",
                className,
            )}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
        >
            <div
                className="absolute inset-y-0 left-0 rounded-full bg-white"
                style={{ width: `${safeValue}%` }}
            />
            <div
                className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/25 bg-white shadow-sm"
                style={{ left: `${safeValue}%` }}
            />
        </div>
    );
}

function InlineYouTubePlayerInner({
    videoId,
    title,
    autoplay = false,
}: InlineYouTubePlayerProps) {
    const playerRef = useRef<HTMLVideoElement | null>(null);
    const lastVolumeRef = useRef(1);
    // Bumping this remounts the underlying iframe, which is how we retry a
    // wedged embed without forcing the user to switch videos.
    const [reloadKey, setReloadKey] = useState(0);
    // Transient message shown when a scrubber drag can't be applied yet, so the
    // interaction gives feedback instead of silently doing nothing.
    const [seekHint, setSeekHint] = useState<string | null>(null);
    const seekHintTimeoutRef = useRef<number | null>(null);
    const [
        {
            currentTime,
            duration,
            isBuffering,
            isMuted,
            isPlaying,
            playbackSpeed,
            progress,
            showControls,
            status,
            useNativeControls,
            volume,
        },
        dispatch,
    ] = useReducer(playerReducer, undefined, createInitialPlayerState);

    useEffect(() => {
        if (typeof window === "undefined") return;

        let cancelled = false;
        const mediaQuery = window.matchMedia(
            "(max-width: 767px), (pointer: coarse)",
        );

        const syncNativeControls = () => {
            if (!cancelled) {
                dispatch({
                    type: "native-controls",
                    enabled: mediaQuery.matches,
                });
            }
        };

        syncNativeControls();
        mediaQuery.addEventListener("change", syncNativeControls);

        void import("@capacitor/core")
            .then(({ Capacitor }) => {
                if (!cancelled && Capacitor.isNativePlatform()) {
                    dispatch({ type: "native-controls", enabled: true });
                }
            })
            .catch(() => {
                // Browser-only render keeps the responsive media-query result.
            });

        return () => {
            cancelled = true;
            mediaQuery.removeEventListener("change", syncNativeControls);
        };
    }, []);

    // If the embed never reports ready, treat it as a failed load so the viewer
    // gets a retry/fallback instead of a dead frame. Ready-state buffering can
    // legitimately last on slow connections, so it should not become a hard
    // player error.
    useEffect(() => {
        if (!shouldArmStuckLoadTimeout(status)) return;

        const timeout = window.setTimeout(() => {
            dispatch({ type: "error" });
        }, STUCK_TIMEOUT_MS);

        return () => window.clearTimeout(timeout);
    }, [status, reloadKey]);

    // Clear any pending seek-hint timer on unmount.
    useEffect(
        () => () => {
            if (seekHintTimeoutRef.current !== null) {
                window.clearTimeout(seekHintTimeoutRef.current);
            }
        },
        [],
    );

    const showSeekHint = (message: string) => {
        setSeekHint(message);
        if (seekHintTimeoutRef.current !== null) {
            window.clearTimeout(seekHintTimeoutRef.current);
        }
        seekHintTimeoutRef.current = window.setTimeout(() => {
            setSeekHint(null);
            seekHintTimeoutRef.current = null;
        }, 2500);
    };

    const url = `https://www.youtube.com/watch?v=${videoId}`;

    const handleRetry = () => {
        // Come back in a clean, honest paused state; autoplay (if requested) is
        // re-applied by onReady once the fresh embed is actually playable.
        dispatch({ type: "reload", playing: false });
        setReloadKey((value) => value + 1);
    };

    // Drive playback off the real media element and reconcile the button against
    // what the iframe actually did. A play() the browser rejects (e.g. unmuted
    // autoplay policy) corrects the state back to paused instead of desyncing.
    const playMedia = () => {
        const player = playerRef.current;
        dispatch({ type: "playing", playing: true });
        const started = player?.play?.();
        if (started && typeof started.then === "function") {
            started.catch(() => {
                dispatch({ type: "playing", playing: player ? !player.paused : false });
            });
        }
    };

    const pauseMedia = () => {
        const player = playerRef.current;
        dispatch({ type: "playing", playing: false });
        player?.pause?.();
    };

    const togglePlay = () => {
        if (status === "error") return;
        if (isPlaying) {
            pauseMedia();
        } else {
            playMedia();
        }
    };

    const handleVolumeChange = (nextValue: number) => {
        const nextVolume = clampPercentage(nextValue) / 100;
        dispatch({ type: "volume", volume: nextVolume });

        if (nextVolume > 0) {
            lastVolumeRef.current = nextVolume;
        }
    };

    const handleTimeUpdate = (event: SyntheticEvent<HTMLVideoElement>) => {
        const media = event.currentTarget;
        const currentTime = Number.isFinite(media.currentTime)
            ? media.currentTime
            : 0;
        const nextDuration = Number.isFinite(media.duration) ? media.duration : duration;

        dispatch({
            type: "progress",
            currentTime,
            progress: nextDuration > 0 ? (currentTime / nextDuration) * 100 : 0,
        });
    };

    const handleSeek = (nextValue: number) => {
        const player = playerRef.current;
        // react-player v3 exposes the underlying media element on the ref, so
        // prefer its live duration and fall back to the tracked value. Bail out
        // while loading/errored or before we have a duration to seek within.
        const seekableDuration =
            player && Number.isFinite(player.duration) && player.duration > 0
                ? player.duration
                : duration;

        // Re-pin the scrubber to the video's real position so a rejected seek
        // snaps the thumb back instead of leaving it stranded where the user
        // released it.
        const repinToReality = () => {
            dispatch({
                type: "seek",
                currentTime,
                progress: seekableDuration
                    ? clampPercentage((currentTime / seekableDuration) * 100)
                    : 0,
            });
        };

        if (!player || status !== "ready" || !seekableDuration) {
            repinToReality();
            showSeekHint(
                status === "ready"
                    ? "Nothing to seek yet"
                    : "Video is still loading…",
            );
            return;
        }

        const playedFraction = clampPercentage(nextValue) / 100;
        const nextTime = playedFraction * seekableDuration;

        try {
            player.currentTime = nextTime;
        } catch {
            // Some embed states reject direct time assignment. Snap back to the
            // real position and surface it, rather than silently doing nothing.
            repinToReality();
            showSeekHint("Couldn't seek right now");
            return;
        }

        dispatch({
            type: "seek",
            currentTime: nextTime,
            progress: playedFraction * 100,
        });
    };

    const toggleMute = () => {
        if (isMuted || volume === 0) {
            const restoredVolume = lastVolumeRef.current > 0 ? lastVolumeRef.current : 1;
            dispatch({ type: "volume", volume: restoredVolume });
            return;
        }

        if (volume > 0) {
            lastVolumeRef.current = volume;
        }
        dispatch({ type: "mute", muted: true });
    };

    const handleSetPlaybackSpeed = (speed: number) => {
        dispatch({ type: "speed", speed });
    };

    return (
        <div
            className="relative aspect-video w-full overflow-hidden border-2 border-[#5FC4E7] bg-[#0A0F1C] dark:border-[#ffffff]/20"
            onMouseEnter={() => {
                if (!useNativeControls) dispatch({ type: "controls", show: true });
            }}
            onMouseLeave={() => {
                if (!useNativeControls) dispatch({ type: "controls", show: false });
            }}
        >
            <div className="absolute inset-0">
                <ReactPlayer
                    ref={playerRef}
                    // Only remount for a different video or an explicit retry.
                    // Keying on autoplay/native-controls flips (which fire from
                    // an effect right after mount on touch devices) forced a
                    // full iframe reload and a black frame on load/switch.
                    key={`${videoId}-${reloadKey}`}
                    src={url}
                    playing={isPlaying}
                    controls={useNativeControls}
                    width="100%"
                    height="100%"
                    volume={volume}
                    muted={isMuted}
                    playbackRate={playbackSpeed}
                    playsInline
                    onReady={() => {
                        dispatch({ type: "ready" });
                        // Apply autoplay intent only once the embed is actually
                        // playable, and reconcile if the browser blocks it.
                        if (autoplay) playMedia();
                    }}
                    onError={() => dispatch({ type: "error" })}
                    onWaiting={() => dispatch({ type: "buffering", buffering: true })}
                    onPlaying={() => {
                        dispatch({ type: "ready" });
                        dispatch({ type: "playing", playing: true });
                    }}
                    onCanPlay={() => dispatch({ type: "buffering", buffering: false })}
                    onPlay={() => dispatch({ type: "playing", playing: true })}
                    onPause={() => dispatch({ type: "playing", playing: false })}
                    onEnded={() => dispatch({ type: "playing", playing: false })}
                    onTimeUpdate={handleTimeUpdate}
                    onDurationChange={(event) =>
                        dispatch({
                            type: "duration",
                            duration: Number.isFinite(event.currentTarget.duration)
                                ? event.currentTarget.duration
                                : 0,
                        })
                    }
                    config={{
                        youtube: {
                            disablekb: useNativeControls ? 0 : 1,
                            fs: 1,
                            iv_load_policy: 3,
                            rel: 0,
                        },
                    }}
                />
            </div>

            {status !== "error" && (status === "loading" || isBuffering) ? (
                <div
                    className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#0A0F1C]/60"
                    role="status"
                    aria-live="polite"
                >
                    <Loader2 className="size-10 animate-spin text-white/90" />
                    <span className="sr-only">Loading video…</span>
                </div>
            ) : null}

            {status === "error" ? (
                <div
                    className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-[#0A0F1C]/90 px-6 text-center"
                    role="alert"
                >
                    <TriangleAlert className="size-8 text-[#5FC4E7]" />
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-white">
                            This video didn&apos;t load
                        </p>
                        <p className="text-xs text-white/70">
                            The player got stuck. Try again, or open it directly
                            on YouTube.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                            type="button"
                            onClick={handleRetry}
                            className="inline-flex items-center gap-2 rounded-md bg-[#5FC4E7] px-3 py-2 text-sm font-semibold text-[#0A0F1C] transition hover:bg-[#5FC4E7]/85"
                        >
                            <RotateCcw className="size-4" />
                            Retry
                        </button>
                        <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-md border border-white/25 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                        >
                            <ExternalLink className="size-4" />
                            Watch on YouTube
                        </a>
                    </div>
                </div>
            ) : null}

            {useNativeControls || status === "error" ? null : (
                <button
                    type="button"
                    onClick={togglePlay}
                    className="absolute inset-0 z-10"
                    aria-label={isPlaying ? "Pause video" : "Play video"}
                >
                    <span className="sr-only">
                        {title ?? "YouTube video player"}
                    </span>
                </button>
            )}

            {useNativeControls || status === "error" ? null : (
                <div
                    className={cn(
                        "absolute bottom-4 left-1/2 z-20 w-[calc(100%-1rem)] max-w-xl -translate-x-1/2 rounded-2xl bg-[#11111198] p-4 backdrop-blur-md transition duration-200",
                        showControls
                            ? "translate-y-0 opacity-100"
                            : "pointer-events-none translate-y-4 opacity-0",
                    )}
                >
                    {seekHint ? (
                        <p
                            className="mx-auto mb-1 max-w-lg text-center text-xs text-white/80"
                            role="status"
                            aria-live="polite"
                        >
                            {seekHint}
                        </p>
                    ) : null}
                    <div className="mx-auto mb-2 flex max-w-lg items-center justify-center gap-2">
                        <span className="text-sm text-white">{formatTime(currentTime)}</span>
                        <Slider
                            value={progress}
                            onChange={handleSeek}
                            className="flex-1"
                            ariaLabel="Seek video"
                        />
                        <span className="text-sm text-white">{formatTime(duration)}</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={togglePlay}
                                className="inline-flex size-10 items-center justify-center rounded-md text-white transition hover:bg-[#111111d1]"
                                aria-label={isPlaying ? "Pause video" : "Play video"}
                            >
                                {isPlaying ? (
                                    <Pause className="size-5" />
                                ) : (
                                    <Play className="size-5" />
                                )}
                            </button>

                            <div className="flex items-center gap-x-1">
                                <button
                                    type="button"
                                    onClick={toggleMute}
                                    className="inline-flex size-10 items-center justify-center rounded-md text-white transition hover:bg-[#111111d1]"
                                    aria-label={isMuted || volume === 0 ? "Unmute video" : "Mute video"}
                                >
                                    {isMuted || volume === 0 ? (
                                        <VolumeX className="size-5" />
                                    ) : volume > 0.5 ? (
                                        <Volume2 className="size-5" />
                                    ) : (
                                        <Volume1 className="size-5" />
                                    )}
                                </button>

                                <div className="w-24">
                                    <Slider
                                        value={isMuted ? 0 : volume * 100}
                                        onChange={handleVolumeChange}
                                        ariaLabel="Adjust volume"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {[0.5, 1, 1.5, 2].map((speed) => (
                                <button
                                    key={speed}
                                    type="button"
                                    onClick={() => handleSetPlaybackSpeed(speed)}
                                    className={cn(
                                        "inline-flex h-9 min-w-10 items-center justify-center rounded-md px-2 text-sm font-medium text-white transition hover:bg-[#111111d1]",
                                        playbackSpeed === speed && "bg-[#111111d1]",
                                    )}
                                    aria-pressed={playbackSpeed === speed}
                                >
                                    {speed}x
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function InlineYouTubePlayer(props: InlineYouTubePlayerProps) {
    return (
        <InlineYouTubePlayerInner
            key={`${props.videoId}:${props.autoplay ? "autoplay" : "manual"}`}
            {...props}
        />
    );
}
