import { useState, useCallback, useRef } from "react";
import { useDragControls } from "framer-motion";

/**
 * Provides drag + expand logic for bottom sheets.
 *
 * Usage:
 *   const { dragControls, isExpanded, sheetProps, handlePointerDownHandle } = useExpandableSheet(onClose);
 *
 * Then on the motion.div:
 *   <motion.div {...sheetProps} style={{ ...sheetProps.style, ...yourOtherStyles }}>
 *     <div ... onPointerDown={handlePointerDownHandle} />  ← drag handle
 *   </motion.div>
 */
export function useExpandableSheet(onClose: () => void) {
  const dragControls = useDragControls();
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(false);

  const vh = typeof window !== "undefined" ? window.innerHeight : 700;
  // 15% of screen = the "hidden" top slice in default state
  const defaultY = Math.round(vh * 0.15);

  // Keep ref in sync (avoids stale closure in onDragEnd)
  const expand = useCallback(() => {
    isExpandedRef.current = true;
    setIsExpanded(true);
  }, []);
  const collapse = useCallback(() => {
    isExpandedRef.current = false;
    setIsExpanded(false);
  }, []);

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
      const { offset, velocity } = info;
      if (!isExpandedRef.current) {
        if (offset.y < -40 || velocity.y < -350) {
          // Swipe up → expand
          expand();
        } else if (offset.y > 80 || velocity.y > 240) {
          // Swipe down → close
          onClose();
        }
        // else: framer springs back to animate target (isExpanded=false → y=defaultY)
      } else {
        if (offset.y > 70 || velocity.y > 240) {
          // Swipe down from expanded → collapse to default
          collapse();
        }
        // else: framer springs back to animate target (isExpanded=true → y=0)
      }
    },
    [onClose, expand, collapse],
  );

  const handlePointerDownHandle = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      dragControls.start(e);
    },
    [dragControls],
  );

  const sheetProps = {
    drag: "y" as const,
    dragControls,
    dragListener: false,
    // Allow travel between the two positions + a little extra for close gesture
    dragConstraints: { top: -defaultY, bottom: defaultY },
    // Tight bottom elastic so the sheet can't drift far below defaultY (which buries drag handle)
    dragElastic: { top: 0.05, bottom: 0.08 },
    // No momentum — prevents velocity-based overshoot after release
    dragMomentum: false,
    onDragEnd: handleDragEnd,
    // animate drives the resting position; framer auto-springs back here after drag
    animate: { y: isExpanded ? 0 : defaultY },
    initial: { y: vh },
    exit: { y: vh },
    transition: { type: "spring" as const, damping: 32, stiffness: 340 },
    style: { height: "100vh" } as React.CSSProperties,
  };

  return { dragControls, isExpanded, defaultY, sheetProps, handlePointerDownHandle };
}
