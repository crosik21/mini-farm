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

  // Keep ref in sync (avoids stale closure in onDragEnd)
  const expand = useCallback(() => { isExpandedRef.current = true; setIsExpanded(true); }, []);
  const collapse = useCallback(() => { isExpandedRef.current = false; setIsExpanded(false); }, []);

  // 15% of screen = the "hidden" top slice in default state
  const vh = typeof window !== "undefined" ? window.innerHeight : 700;
  const defaultY = Math.round(vh * 0.15);

  const handleDragEnd = useCallback((_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
    const { offset, velocity } = info;
    if (!isExpandedRef.current) {
      if (offset.y < -40 || velocity.y < -350) {
        // Swipe up → expand
        expand();
      } else if (offset.y > 90 || velocity.y > 260) {
        // Swipe down → close
        onClose();
      }
      // else snap back (framer does it automatically)
    } else {
      if (offset.y > 80 || velocity.y > 260) {
        // Swipe down from expanded → collapse to default
        collapse();
      }
      // else stay expanded (snap back to y=0)
    }
  }, [onClose, expand, collapse]);

  const handlePointerDownHandle = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    dragControls.start(e);
  }, [dragControls]);

  const sheetProps = {
    drag: "y" as const,
    dragControls,
    dragListener: false,
    dragConstraints: { top: isExpanded ? 0 : -defaultY, bottom: 0 },
    dragElastic: { top: 0.05, bottom: 0.45 },
    onDragEnd: handleDragEnd,
    animate: { y: isExpanded ? 0 : defaultY },
    initial: { y: vh },
    exit: { y: vh },
    transition: { type: "spring" as const, damping: 30, stiffness: 320 },
    style: { height: "100vh" } as React.CSSProperties,
  };

  return { dragControls, isExpanded, sheetProps, handlePointerDownHandle };
}
