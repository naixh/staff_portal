/**
 * The Maldivian Rufiyaa sign — U+20C2 (Unicode 18.0).
 *
 * U+20C2 is brand new, so virtually no font ships a glyph for it yet and the
 * character renders as a "tofu" box on device fonts. To display the sign
 * reliably everywhere we draw it as a small vector instead of a font glyph.
 *
 * The outline follows the official design: the Thaana letter "raa" (U+0783)
 * with an added parallel horizontal stroke. Path data adapted from the
 * public-domain "Rufiyaa sign angular.svg" on Wikimedia Commons.
 */
import type { ReactNode } from "react";
import type { Currency } from "@/models/types";
import { formatAmount } from "@/utils/format";

/** Bare rufiyaa glyph. Size and colour it via `className` (uses `currentColor`). */
export function RufiyaaSign({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 691.49713 703.64148"
      aria-hidden="true"
      focusable="false"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="currentColor"
        d="m 498.66096,435.9393 77.1346,-91.9254 -144.8889,-38.8228 38.567,-45.9625 144.8889,38.8228 77.1346,-91.9254 L 546.60826,167.3032 688.02966,25.882 591.43706,0 450.01566,141.4211 v 0 l -96.5926,-25.882 -77.1346,91.9254 96.5926,25.882 -38.63142,46.0698 -96.59258,-25.882 -77.1346,91.9254 96.59258,25.882 L 0,677.7595 96.59258,703.6415 353.73986,397.1701 Z"
      />
    </svg>
  );
}

/** A monetary amount: the currency sign followed by the grouped number. */
export function Money({
  value,
  currency = "MVR",
  className,
}: {
  value: number;
  /** Defaults to MVR; pass USD to show dollars. */
  currency?: Currency;
  className?: string;
}): ReactNode {
  return (
    <span
      className={`inline-flex items-center gap-[0.15em] tabular-nums ${
        className ?? ""
      }`}
    >
      {currency === "USD" ? (
        <span className="shrink-0">$</span>
      ) : (
        <RufiyaaSign className="h-[0.85em] w-[0.835em] shrink-0" />
      )}
      {formatAmount(value)}
      <span className="sr-only">{currency}</span>
    </span>
  );
}
