export interface AnchorBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Calculates the anchor point on source's edge closest to target. */
export function getSmartAnchor(source: AnchorBox, target: AnchorBox): { x: number; y: number } {
  const srcCx = source.x + source.width / 2;
  const srcCy = source.y + source.height / 2;
  const tgtCx = target.x + target.width / 2;
  const tgtCy = target.y + target.height / 2;

  const dx = tgtCx - srcCx;
  const dy = tgtCy - srcCy;

  // Horizontal dominance
  if (Math.abs(dx) > Math.abs(dy) * 1.1) {
    if (dx > 0) {
      // Connects from right edge
      return { x: source.x + source.width, y: srcCy };
    } else {
      // Connects from left edge
      return { x: source.x, y: srcCy };
    }
  } else {
    // Vertical dominance
    if (dy > 0) {
      // Connects from bottom edge
      return { x: srcCx, y: source.y + source.height };
    } else {
      // Connects from top pin
      return { x: srcCx, y: source.y - 4 };
    }
  }
}

/** A zero-size box standing in for a free-floating (detached) connector endpoint. */
export function pointBox(point: { x: number; y: number }): AnchorBox {
  return { x: point.x, y: point.y, width: 0, height: 0 };
}
