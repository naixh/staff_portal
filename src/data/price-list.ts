/**
 * The salon's price list (Vin Style), in both currencies.
 *
 * Used to seed the services catalog on a fresh install, and by the "Load price
 * list" shortcut on the Services page to add anything that's missing.
 */
export interface CatalogService {
  name: string;
  /** Price in MVR. */
  price: number;
  /** Price in USD. */
  priceUsd: number;
  category?: string;
}

export const PRICE_LIST: CatalogService[] = [
  // Regular services
  { name: "Normal haircut", price: 70, priceUsd: 5, category: "Haircut" },
  { name: "Long Haircut", price: 170, priceUsd: 10, category: "Haircut" },
  { name: "Mustache", price: 30, priceUsd: 2, category: "Beard" },
  { name: "Beard Trim", price: 50, priceUsd: 5, category: "Beard" },
  { name: "Beard Shaving", price: 50, priceUsd: 5, category: "Beard" },
  { name: "Colour & Wash", price: 100, priceUsd: 7, category: "Colour" },
  { name: "Long Hair Colour", price: 200, priceUsd: 12, category: "Colour" },
  { name: "Head Massage", price: 70, priceUsd: 6, category: "Massage" },
  { name: "Facial Massage (Scrub)", price: 70, priceUsd: 6, category: "Massage" },
  { name: "Steam & Massage", price: 130, priceUsd: 8, category: "Massage" },
  { name: "Dandruff Treatment", price: 300, priceUsd: 20, category: "Treatment" },
  { name: "Wash", price: 20, priceUsd: 1, category: "Wash" },
  // Packages
  { name: "Fresh look", price: 300, priceUsd: 20, category: "Package" },
  { name: "Magic look", price: 250, priceUsd: 16, category: "Package" },
];
