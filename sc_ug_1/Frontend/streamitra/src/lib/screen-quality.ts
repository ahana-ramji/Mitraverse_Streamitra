export type RenditionSize = {
  width: number;
  height: number;
};

// A source can be sharper than the CSS box without treating a high-DPI phone
// as a desktop-sized player.
export const DISPLAY_HEADROOM = 1.5;
export const FIT_TOLERANCE = 1.2;

/**
 * Returns the highest rendition that fits the rendered player dimensions.
 * Renditions do not have to arrive in quality order.
 * Multiplies the player width and height by the headroom and tolerance
 */
export function maxRenditionIndex(
  levels: RenditionSize[],
  playerWidth: number,
  playerHeight: number,
): number {
  const targetWidth = playerWidth * DISPLAY_HEADROOM * FIT_TOLERANCE; 
  const targetHeight = playerHeight * DISPLAY_HEADROOM * FIT_TOLERANCE;

  let bestIndex = 0;
  let bestHeight = 0;

  // Checks every HLS rendition to find the highest one that fits within the target dimensions 
  levels.forEach((level, index) => {
    const fits = level.width <= targetWidth && level.height <= targetHeight;

    if (fits && level.height > bestHeight) {
      bestIndex = index;
      bestHeight = level.height;
    }
  });

  return bestIndex;
}
