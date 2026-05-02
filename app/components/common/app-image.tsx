import NextImage, {
  type ImageProps as NextImageProps,
  type StaticImageData,
} from "next/image";
import type { ImgHTMLAttributes } from "react";

type StaticImageLike = StaticImageData | {
  src: string;
  width?: number;
  height?: number;
};

type AppImageProps = Omit<NextImageProps, "src" | "alt" | "width" | "height"> & {
  src: string | StaticImageLike;
  alt: string;
  width?: NextImageProps["width"];
  height?: NextImageProps["height"];
  fill?: boolean;
};

function resolveImageSource(source: AppImageProps["src"]) {
  if (typeof source === "string") {
    return { src: source, width: undefined, height: undefined };
  }

  return {
    src: source.src,
    width: source.width,
    height: source.height,
  };
}

function shouldBypassNextOptimizer(src: string) {
  if (src.endsWith(".svg")) {
    return true;
  }

  try {
    const url = new URL(src);
    return url.hostname.endsWith(".blob.core.windows.net");
  } catch {
    return false;
  }
}

export default function AppImage({
  src,
  alt,
  width,
  height,
  fill = false,
  priority = false,
  className,
  loading,
  decoding,
  fetchPriority,
  ...rest
}: AppImageProps) {
  const resolvedSource = resolveImageSource(src);
  const resolvedWidth = fill ? undefined : width ?? resolvedSource.width;
  const resolvedHeight = fill ? undefined : height ?? resolvedSource.height;
  const resolvedClassName = fill
    ? ["absolute inset-0 h-full w-full", className].filter(Boolean).join(" ")
    : className;

  if (!fill && (resolvedWidth === undefined || resolvedHeight === undefined)) {
    const nativeProps = rest as Omit<
      ImgHTMLAttributes<HTMLImageElement>,
      "src" | "alt" | "width" | "height"
    >;

    return (
      <img
        {...nativeProps}
        src={resolvedSource.src}
        alt={alt}
        width={resolvedWidth}
        height={resolvedHeight}
        className={resolvedClassName}
        loading={priority ? "eager" : loading ?? "lazy"}
        decoding={decoding ?? "async"}
        fetchPriority={priority ? "high" : fetchPriority}
      />
    );
  }

  return (
    <NextImage
      {...rest}
      src={resolvedSource.src}
      alt={alt}
      width={resolvedWidth}
      height={resolvedHeight}
      fill={fill}
      className={resolvedClassName}
      decoding={decoding ?? "async"}
      loading={priority ? undefined : loading}
      priority={priority}
      fetchPriority={fetchPriority}
      unoptimized={
        typeof resolvedSource.src === "string" &&
        shouldBypassNextOptimizer(resolvedSource.src)
      }
    />
  );
}
