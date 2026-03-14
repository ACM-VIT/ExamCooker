import type { ImgHTMLAttributes } from "react";

type StaticImageLike = {
  src: string;
  width?: number;
  height?: number;
};

type NativeImageProps = ImgHTMLAttributes<HTMLImageElement>;

type AppImageProps = Omit<NativeImageProps, "src" | "width" | "height"> & {
  src: string | StaticImageLike;
  alt: string;
  width?: NativeImageProps["width"];
  height?: NativeImageProps["height"];
  fill?: boolean;
  priority?: boolean;
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

  return (
    <img
      {...rest}
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
