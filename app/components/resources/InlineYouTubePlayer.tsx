"use client";

type InlineYouTubePlayerProps = {
    videoId: string;
    title?: string;
    autoplay?: boolean;
};

export default function InlineYouTubePlayer({
    videoId,
    title,
    autoplay = false,
}: InlineYouTubePlayerProps) {
    const params = new URLSearchParams({
        rel: "0",
        modestbranding: "1",
        playsinline: "1",
        ...(autoplay ? { autoplay: "1" } : {}),
    });
    const src = `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;

    return (
        <div className="relative aspect-video w-full overflow-hidden border-2 border-[#5FC4E7] bg-black dark:border-[#ffffff]/20">
            <iframe
                key={`${videoId}-${autoplay ? "a" : "p"}`}
                src={src}
                title={title ?? "YouTube video player"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
            />
        </div>
    );
}
