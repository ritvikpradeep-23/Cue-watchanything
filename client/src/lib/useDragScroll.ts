import { useRef } from "react";

/** Click-and-drag horizontal scrolling for mouse/trackpad users on a `.carousel-row` — touch
 * already scrolls natively, and the CSS scrollbar gives a visible affordance, but dragging the
 * row itself (not just the scrollbar thumb) is the more natural desktop interaction. */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const state = useRef({ dragging: false, startX: 0, startScrollLeft: 0, moved: false });

  function onPointerDown(e: React.PointerEvent) {
    const el = ref.current;
    if (!el) return;
    state.current = { dragging: true, startX: e.clientX, startScrollLeft: el.scrollLeft, moved: false };
    el.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el || !state.current.dragging) return;
    const dx = e.clientX - state.current.startX;
    if (Math.abs(dx) > 3) state.current.moved = true;
    el.scrollLeft = state.current.startScrollLeft - dx;
  }

  function onPointerUp(e: React.PointerEvent) {
    const el = ref.current;
    if (el) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // no-op — capture may already be released
      }
    }
    state.current.dragging = false;
  }

  /** A click that ended without dragging should still navigate (e.g. the poster's <Link>) —
   * only suppress the click when the pointer actually moved. */
  function onClickCapture(e: React.MouseEvent) {
    if (state.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      state.current.moved = false;
    }
  }

  return { ref, onPointerDown, onPointerMove, onPointerUp, onPointerLeave: onPointerUp, onClickCapture };
}
