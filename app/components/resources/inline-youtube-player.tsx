"use client";

import { useEffect, useRef, useState } from "react";
import ReactPlayer from "react-player";
import { Pause, Play, Volume1, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

type InlineYouTubePlayerProps = {
    videoId: string;
    title?: string;
    autoplay?: boolean;
};

type ProgressState = {
    played: number;
    playedSeconds: number;
    loaded: number;
    loadedSeconds: number;
};

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
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/25 bg-white shadow-sm"
                style={{ left: `${safeValue}%` }}
            />
        </div>
    );
}

export default function InlineYouTubePlayer({
    videoId,
    title,
    autoplay = false,
}: InlineYouTubePlayerProps) {
    const playerRef = useRef<ReactPlayer | null>(null);
    const lastVolumeRef = useRef(1);
    const [isPlaying, setIsPlaying] = useState(autoplay);
    const [volume, setVolume] = useState(1);
    const [progress, setProgress] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [showControls, setShowControls] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [useNativeControls, setUseNativeControls] = useState(false);

    useEffect(() => {
        setIsPlaying(autoplay);
        setProgress(0);
        setCurrentTime(0);
        setDuration(0);
        setPlaybackSpeed(1);
    }, [videoId, autoplay]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        let cancelled = false;
        const mediaQuery = window.matchMedia(
            "(max-width: 767px), (pointer: coarse)",
        );

        const syncNativeControls = () => {
            if (!cancelled) {
                setUseNativeControls(mediaQuery.matches);
            }
        };

        syncNativeControls();
        mediaQuery.addEventListener("change", syncNativeControls);

        void import("@capacitor/core")
            .then(({ Capacitor }) => {
                if (!cancelled && Capacitor.isNativePlatform()) {
                    setUseNativeControls(true);
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
        setIsPlaying((current) => !current);
    };

    const handleVolumeChange = (nextValue: number) => {
        const nextVolume = clampPercentage(nextValue) / 100;
        setVolume(nextVolume);
        setIsMuted(nextVolume === 0);

        if (nextVolume > 0) {
            lastVolumeRef.current = nextVolume;
        }
    };

    const handleProgress = (state: ProgressState) => {
        setCurrentTime(state.playedSeconds);
        setProgress(state.played * 100);
    };

    const handleSeek = (nextValue: number) => {
        const player = playerRef.current;
        if (!player || !duration) {
            return;
        }

        const playedFraction = clampPercentage(nextValue) / 100;
        player.seekTo(playedFraction, "fraction");
        setProgress(playedFraction * 100);
        setCurrentTime(playedFraction * duration);
    };

    const toggleMute = () => {
        if (isMuted || volume === 0) {
            const restoredVolume = lastVolumeRef.current > 0 ? lastVolumeRef.current : 1;
            setVolume(restoredVolume);
            setIsMuted(false);
            return;
        }

        if (volume > 0) {
            lastVolumeRef.current = volume;
        }
        setIsMuted(true);
    };

    const handleSetPlaybackSpeed = (speed: number) => {
        setPlaybackSpeed(speed);
    };

    return (
        <div
            className="relative aspect-video w-full overflow-hidden border-2 border-[#5FC4E7] bg-black dark:border-[#ffffff]/20"
            onMouseEnter={() => {
                if (!useNativeControls) setShowControls(true);
            }}
            onMouseLeave={() => {
                if (!useNativeControls) setShowControls(false);
            }}
        >
            <div className="absolute inset-0">
                <ReactPlayer
                    ref={playerRef}
                    key={`${videoId}-${autoplay ? "a" : "p"}-${useNativeControls ? "native" : "custom"}`}
                    url={url}
                    playing={isPlaying}
                    controls={useNativeControls}
                    width="100%"
                    height="100%"
                    volume={volume}
                    muted={isMuted}
                    playbackRate={playbackSpeed}
                    playsinline
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    onProgress={handleProgress}
                    onDuration={setDuration}
                    config={{
                        youtube: {
                            playerVars: {
                                autoplay: autoplay ? 1 : 0,
                                controls: useNativeControls ? 1 : 0,
                                disablekb: useNativeControls ? 0 : 1,
                                fs: 1,
                                iv_load_policy: 3,
                                modestbranding: 1,
                                playsinline: 1,
                                rel: 0,
                            },
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
                                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-white transition hover:bg-[#111111d1]"
                                aria-label={isPlaying ? "Pause video" : "Play video"}
                            >
                                {isPlaying ? (
                                    <Pause className="h-5 w-5" />
                                ) : (
                                    <Play className="h-5 w-5" />
                                )}
                            </button>

                            <div className="flex items-center gap-x-1">
                                <button
                                    type="button"
                                    onClick={toggleMute}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-md text-white transition hover:bg-[#111111d1]"
                                    aria-label={isMuted || volume === 0 ? "Unmute video" : "Mute video"}
                                >
                                    {isMuted || volume === 0 ? (
                                        <VolumeX className="h-5 w-5" />
                                    ) : volume > 0.5 ? (
                                        <Volume2 className="h-5 w-5" />
                                    ) : (
                                        <Volume1 className="h-5 w-5" />
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
