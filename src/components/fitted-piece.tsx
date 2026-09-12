import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function FittedPiece({
  src,
  alt = "",
  eager,
  className,
  onRatio,
}: {
  src: string;
  alt?: string;
  eager?: boolean;
  className?: string;
  onRatio?: (ratio: number) => void;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [shown, setShown] = useState(src);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setShown(src);
    setReady(false);
    setFailed(false);
  }, [src]);

  useEffect(() => {
    const img = ref.current;
    if (!img) return;
    const apply = () => {
      if (img.naturalWidth) {
        setReady(true);
        onRatio?.(img.naturalWidth / img.naturalHeight);
      }
    };
    if (img.complete && img.naturalWidth) apply();
    img.addEventListener("load", apply);
    return () => img.removeEventListener("load", apply);
  }, [shown, onRatio]);

  if (failed) return null;

  return (
    <img
      ref={ref}
      src={shown}
      alt=""
      draggable={false}
      loading={eager ? "eager" : "lazy"}
      decoding={eager ? "sync" : "async"}
      fetchPriority={eager ? "high" : "auto"}
      onError={() => {
        const bare = shown.split("?")[0];
        if (bare && bare !== shown) {
          setShown(bare);
          return;
        }
        setFailed(true);
      }}
      className={cn(
        "size-full object-contain object-center",
        ready ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}
