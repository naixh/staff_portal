import type { ComponentType } from "react";
import {
  Banknote,
  Hand,
  Landmark,
  Paintbrush,
  ScanFace,
  Scissors,
  Sparkles,
  Wallet,
} from "lucide-react";
import type { PaymentMethodOption } from "@/models/types";

type IconComponent = ComponentType<{ className?: string }>;

/** Badge palette — payment methods are coloured by their position in the list. */
const PAYMENT_BADGES = [
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-teal-100 text-teal-700",
];

/** Human label for a payment method id. */
export function paymentLabel(methods: PaymentMethodOption[], id: string): string {
  return methods.find((method) => method.id === id)?.label ?? id;
}

/** Tailwind classes for a payment badge. */
export function paymentBadgeClass(
  methods: PaymentMethodOption[],
  id: string,
): string {
  const index = methods.findIndex((method) => method.id === id);
  return PAYMENT_BADGES[(index >= 0 ? index : 0) % PAYMENT_BADGES.length];
}

/** A sensible icon for a payment method id. */
export function paymentIcon(id: string): IconComponent {
  switch (id) {
    case "cash":
      return Banknote;
    case "transfer":
    case "card":
      return Landmark;
    default:
      return Wallet;
  }
}

/** Pick an icon that suits a service's category. */
export function serviceIcon(category?: string): IconComponent {
  switch ((category ?? "").toLowerCase()) {
    case "hair":
      return Scissors;
    case "beard":
    case "shave":
      return ScanFace;
    case "combo":
      return Sparkles;
    case "color":
    case "coloring":
      return Paintbrush;
    case "massage":
      return Hand;
    default:
      return Scissors;
  }
}
