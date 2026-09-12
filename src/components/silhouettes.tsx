import type { ReactNode } from "react";
import type { ExtraKind, GarmentCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

function Svg({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      className={cn("size-12", className)}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function GarmentSilhouette({
  category,
  className,
}: {
  category: GarmentCategory;
  className?: string;
}) {
  switch (category) {
    case "outerwear":
      return (
        <Svg className={className}>
          <path d="M7 9.5 12 6h8l5 3.5V26h-4.2V14.5h-9.6V26H7V9.5Z" />
        </Svg>
      );
    case "tops":
      return (
        <Svg className={className}>
          <path d="M6 8.5 12 6l1.4 3.2h5.2L20 6l6 2.5-2.2 4.2V26H8.2V12.7Z" />
        </Svg>
      );
    case "bottoms":
      return (
        <Svg className={className}>
          <path d="M10 6h12l-.6 4.2H10.6L10 6Zm.4 5.2h4.4L13.6 26h-3.4l.2-14.8Zm6.8 0h4.4l.2 14.8h-3.4l-1.2-14.8Z" />
        </Svg>
      );
    case "dresses":
      return (
        <Svg className={className}>
          <path d="M13 6h6l1 3.2 4 1.4-3.2 15.4H11.2L8 10.6l4-1.4Z" />
        </Svg>
      );
    case "footwear":
      return (
        <Svg className={className}>
          <path d="M6 18.5c3.2-1.2 5-4.8 9.4-5.2 3.2-.3 5.2 1.4 8.2 2.6 2.2.9 3.4 2.2 2.2 4.2H7.2c-1.6 0-2.2-1-1.2-1.6Z" />
        </Svg>
      );
    case "accessories":
      return (
        <Svg className={className}>
          <path d="M10 8.5h12v2.2h-1.6v3.2A6.4 6.4 0 1 1 9.6 13.9V10.7H8V8.5h2Zm6 6.2a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4Z" />
        </Svg>
      );
    case "bags":
      return (
        <Svg className={className}>
          <path d="M11.2 8.2h9.6l1.4 3.2H9.8l1.4-3.2ZM8.4 12.2h15.2V24.6H8.4V12.2Z" />
        </Svg>
      );
    default:
      return null;
  }
}

export function ExtraSilhouette({
  kind,
  className,
}: {
  kind: ExtraKind;
  className?: string;
}) {
  switch (kind) {
    case "skincare":
      return (
        <Svg className={className}>
          <path d="M13.2 5.5h5.6v3.2h-5.6V5.5Zm-1.6 4h8.8v17H11.6v-17Z" />
        </Svg>
      );
    case "fragrance":
      return (
        <Svg className={className}>
          <path d="M14 5h4v3.4h2.4v2.4H11.6V8.4H14V5Zm-2.8 6.6h9.6V27h-9.6V11.6Z" />
        </Svg>
      );
    case "grooming":
      return (
        <Svg className={className}>
          <path d="M8 10h16v3.2c-2.2 1-3.4 3.4-3.4 6.2V26h-9.2v-6.6c0-2.8-1.2-5.2-3.4-6.2V10Z" />
        </Svg>
      );
    default:
      return (
        <Svg className={className}>
          <rect x="8" y="8" width="16" height="16" rx="3" />
        </Svg>
      );
  }
}
