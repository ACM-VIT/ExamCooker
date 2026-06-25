"use client";

import { type SyntheticEvent, useEffect, useReducer, useRef } from "react";
import ReactPlayer from "react-player";
import { Pause, Play, Volume1, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

type InlineYouTubePlayerProps = {
    videoId: string;
    title?: string;
    autoplay?: boolean;
};

type PlayerState = {
    currentTime: number;
    duration: number;
    isMuted: boolean;
    isPlaying: boolean;
    playbackSpeed: number;
    progress: number;
    showControls: boolean;
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
    | { type: "native-controls"; enabled: boolean };

function createInitialPlayerState(autoplay: boolean): PlayerState {
    return {
        currentTime: 0,
        duration: 0,
        isMuted: false,
        isPlaying: autoplay,
        playbackSpeed: 1,
        progress: 0,
        showControls: false,
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
    const [
        {
            currentTime,
            duration,
            isMuted,
            isPlaying,
            playbackSpeed,
            progress,
            showControls,
            useNativeControls,
            volume,
        },
        dispatch,
    ] = useReducer(playerReducer, autoplay, createInitialPlayerState);

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

    const url = `https://www.youtube.com/watch?v=${videoId}`;

    const togglePlay = () => {
        dispatch({ type: "playing", playing: !isPlaying });
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
        if (!player || !duration) {
            return;
        }

        const playedFraction = clampPercentage(nextValue) / 100;
        player.currentTime = playedFraction * duration;
        dispatch({
            type: "seek",
            currentTime: playedFraction * duration,
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
                    key={`${videoId}-${autoplay ? "a" : "p"}-${useNativeControls ? "native" : "custom"}`}
                    src={url}
                    playing={isPlaying}
                    controls={useNativeControls}
                    width="100%"
                    height="100%"
                    volume={volume}
                    muted={isMuted}
                    playbackRate={playbackSpeed}
                    playsInline
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

            {useNativeControls ? null : (
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

            {useNativeControls ? null : (
                <div
                    className={cn(
                        "absolute bottom-4 left-1/2 z-20 w-[calc(100%-1rem)] max-w-xl -translate-x-1/2 rounded-2xl bg-[#11111198] p-4 backdrop-blur-md transition duration-200",
                        showControls
                            ? "translate-y-0 opacity-100"
                            : "pointer-events-none translate-y-4 opacity-0",
                    )}
                >
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
