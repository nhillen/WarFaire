/**
 * Card Art Mapping - Presentational Only
 * Maps category IDs to card art image paths
 */

export const CARD_ART: Record<string, string> = {
  pumpkins: "/assets/card_art/pumpkins.png",
  carrots: "/assets/card_art/carrots.png",
  tomatoes: "/assets/card_art/tomatoes.png",
  corn: "/assets/card_art/corn.png",
  pies: "/assets/card_art/pies.png",
  cakes: "/assets/card_art/cake.png",
  breads: "/assets/card_art/bread.png",
  cookies: "/assets/card_art/cookies.png",
  chickens: "/assets/card_art/chickens.png",
  pigs: "/assets/card_art/pigs.png",
  cows: "/assets/card_art/cows.png",
  goats: "/assets/card_art/goats.png"
};

/**
 * Get card art path for a category ID
 * Falls back to pies.png if category not found
 */
export function getCardArt(categoryId: string): string {
  return CARD_ART[categoryId] ?? "/assets/card_art/pies.png";
}
