import { useEffect, useRef } from 'react';
import type React from 'react';
import type Konva from 'konva';
import { useBoardStore } from '../../store/boardStore';

// ─── Constants ────────────────────────────────────────────────────────
const LONG_PRESS_DELAY = 500;
const MOVE_THRESHOLD   = 8;
const MIN_SCALE        = 0.1;
const MAX_SCALE        = 4;

// ─── Helpers ─────────────────────────────────────────────────────────

function getTouchDistance(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getTouchMidpoint(t1: Touch, t2: Touch): { x: number; y: number } {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}

function isBackgroundNode(node: Konva.Node | null): boolean {
  if (!node) return true;
  const name = node.name();
  return name === 'background' || name === 'dot' || name === 'cluster-bg' || name === '';
}

function findBoardElementId(node: Konva.Node): string | null {
  const store = useBoardStore.getState();
  const allIds = new Set<string>([
    ...store.cards.map(c => c.id),
    ...store.shapes.map(s => s.id),
    ...store.connectors.map(c => c.id),
    ...store.clusters.map(c => c.id),
    ...store.textItems.map(t => t.id),
    ...store.voteDots.map(d => d.id),
    ...store.images.map(i => i.id),
  ]);

  let current: Konva.Node | null = node;
  while (current) {
    const id = current.id();
    if (id && allIds.has(id)) return id;
    const parent = current.getParent() as Konva.Node | null;
    if (!parent || parent === current) break;
    current = parent;
  }
  return null;
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useTouchCanvas(
  stageRef: React.RefObject<Konva.Stage | null>
): void {
  const longPressTimer           = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRect            = useRef<DOMRect | null>(null);
  const touchStartClient         = useRef<{ x: number; y: number } | null>(null);
  const touchStartOnBackground   = useRef(false);
  const didMoveBeyondThreshold   = useRef(false);
  const isMultiTouch             = useRef(false);
  const suppressNextTap          = useRef(false);
  const lastTouchDist            = useRef<number | null>(null);
  const lastTouchMidClient       = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const container = stage.container();

    const cancelLongPress = () => {
      if (longPressTimer.current !== null) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };

    const toContainerPos = (clientX: number, clientY: number) => {
      const rect = containerRect.current ?? container.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      containerRect.current = container.getBoundingClientRect();

      if (e.touches.length >= 2) {
        isMultiTouch.current    = true;
        suppressNextTap.current = true;
        cancelLongPress();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        lastTouchDist.current      = getTouchDistance(t1, t2);
        lastTouchMidClient.current = getTouchMidpoint(t1, t2);
        return;
      }

      if (e.touches.length === 1) {
        isMultiTouch.current           = false;
        const touch                    = e.touches[0];
        touchStartClient.current       = { x: touch.clientX, y: touch.clientY };
        didMoveBeyondThreshold.current = false;

        const stagePos = toContainerPos(touch.clientX, touch.clientY);
        const hitNode  = stage.getIntersection(stagePos);
        touchStartOnBackground.current = isBackgroundNode(hitNode);

        if (!touchStartOnBackground.current && hitNode) {
          const targetId  = findBoardElementId(hitNode);
          if (targetId) {
            const cx = touch.clientX;
            const cy = touch.clientY;
            longPressTimer.current = setTimeout(() => {
              if (!didMoveBeyondThreshold.current) {
                window.dispatchEvent(
                  new CustomEvent('canvas-context-menu', {
                    detail: { clientX: cx, clientY: cy, targetId },
                  })
                );
              }
            }, LONG_PRESS_DELAY);
          }
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();

      if (e.touches.length >= 2) {
        isMultiTouch.current = true;
        cancelLongPress();

        const t1           = e.touches[0];
        const t2           = e.touches[1];
        const newDist      = getTouchDistance(t1, t2);
        const newMidClient = getTouchMidpoint(t1, t2);

        if (lastTouchDist.current !== null && lastTouchMidClient.current !== null) {
          const store    = useBoardStore.getState();
          const viewport = store.viewport;
          const oldScale = viewport.scale;

          const scaleFactor = newDist / lastTouchDist.current;
          const newScale    = Math.max(MIN_SCALE, Math.min(MAX_SCALE, oldScale * scaleFactor));

          const prevMidC = toContainerPos(lastTouchMidClient.current.x, lastTouchMidClient.current.y);
          const newMidC  = toContainerPos(newMidClient.x, newMidClient.y);

          // World point under previous midpoint must stay under new midpoint
          const worldX = (prevMidC.x - viewport.x) / oldScale;
          const worldY = (prevMidC.y - viewport.y) / oldScale;

          store.setViewport({
            scale: newScale,
            x: newMidC.x - worldX * newScale,
            y: newMidC.y - worldY * newScale,
          });
        }

        lastTouchDist.current      = newDist;
        lastTouchMidClient.current = newMidClient;
        return;
      }

      if (e.touches.length === 1 && !isMultiTouch.current && touchStartClient.current) {
        const touch = e.touches[0];
        const dx    = touch.clientX - touchStartClient.current.x;
        const dy    = touch.clientY - touchStartClient.current.y;

        if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
          if (!didMoveBeyondThreshold.current) {
            didMoveBeyondThreshold.current = true;
            cancelLongPress();
          }
        }

        const store      = useBoardStore.getState();
        const shouldPan  = didMoveBeyondThreshold.current &&
          (touchStartOnBackground.current || store.activeTool === 'hand');

        if (shouldPan) {
          const vp = store.viewport;
          store.setViewport({ ...vp, x: vp.x + dx, y: vp.y + dy });
          touchStartClient.current = { x: touch.clientX, y: touch.clientY };
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      cancelLongPress();

      if (e.touches.length === 1) {
        lastTouchDist.current          = null;
        lastTouchMidClient.current     = null;
        const remaining                = e.touches[0];
        touchStartClient.current       = { x: remaining.clientX, y: remaining.clientY };
        didMoveBeyondThreshold.current = false;
        touchStartOnBackground.current = false;
        return;
      }

      if (e.touches.length === 0) {
        const wasMulti         = isMultiTouch.current;
        isMultiTouch.current   = false;
        lastTouchDist.current  = null;
        lastTouchMidClient.current = null;

        // Single tap on background → clear selection
        // (double-tap → card creation is handled by Konva onDblTap on Stage)
        if (
          !wasMulti &&
          !suppressNextTap.current &&
          !didMoveBeyondThreshold.current &&
          touchStartOnBackground.current &&
          e.changedTouches.length === 1
        ) {
          useBoardStore.getState().clearSelection();
        }

        suppressNextTap.current        = false;
        touchStartClient.current       = null;
        touchStartOnBackground.current = false;
        didMoveBeyondThreshold.current = false;
      }
    };

    const onTouchCancel = () => {
      cancelLongPress();
      isMultiTouch.current           = false;
      suppressNextTap.current        = false;
      lastTouchDist.current          = null;
      lastTouchMidClient.current     = null;
      touchStartClient.current       = null;
      touchStartOnBackground.current = false;
      didMoveBeyondThreshold.current = false;
    };

    container.addEventListener('touchstart',  onTouchStart,  { passive: false });
    container.addEventListener('touchmove',   onTouchMove,   { passive: false });
    container.addEventListener('touchend',    onTouchEnd,    { passive: false });
    container.addEventListener('touchcancel', onTouchCancel, { passive: false });

    return () => {
      container.removeEventListener('touchstart',  onTouchStart);
      container.removeEventListener('touchmove',   onTouchMove);
      container.removeEventListener('touchend',    onTouchEnd);
      container.removeEventListener('touchcancel', onTouchCancel);
      cancelLongPress();
    };
  }, [stageRef]);
}
