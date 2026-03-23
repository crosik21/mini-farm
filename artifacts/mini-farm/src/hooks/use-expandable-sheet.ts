import { useState, useCallback, useRef, useEffect } from "react";
import { useDragControls, useAnimationControls } from "framer-motion";

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

const SPRING = { type: "spring" as const, damping: 32, stiffness: 340 };
const SPRING_CLOSE = { type: "spring" as const, damping: 30, stiffness: 260 };

export function useExpandableSheet(onClose: () => void) {
  const dragControls = useDragControls();
  const controls = useAnimationControls();
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(false);

  const vh = typeof window !== "undefined" ? window.innerHeight : 700;
  // 15% of screen = the "hidden" top slice in default state
  const defaultY = Math.round(vh * 0.15);

  // Start in default position after mount
  useEffect(() => {
    controls.start({ y: defaultY, transition: SPRING });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const expand = useCallback(() => {
    isExpandedRef.current = true;
    setIsExpanded(true);
    controls.start({ y: 0, transition: SPRING });
  }, [controls]);

  const collapse = useCallback(() => {
    isExpandedRef.current = false;
    setIsExpanded(false);
    controls.start({ y: defaultY, transition: SPRING });
  }, [controls, defaultY]);

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
        } else {
          // Snap back to default — explicit so the sheet never drifts below defaultY
          controls.start({ y: defaultY, transition: SPRING });
        }
      } else {
        if (offset.y > 70 || velocity.y > 240) {
          // Swipe down from expanded → collapse to default
          collapse();
        } else {
          // Snap back to expanded
          controls.start({ y: 0, transition: SPRING });
        }
      }
    },
    [controls, defaultY, onClose, expand, collapse],
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
    animate: controls,
    // Constraint range covers default ↔ expanded travel; clamped to prevent
    // the sheet drifting too far below the screen (which buries the drag handle).
    dragConstraints: { top: -defaultY, bottom: defaultY },
    dragElastic: { top: 0.05, bottom: 0.08 }, // tight elastic on bottom = no big drift down
    dragMomentum: false,
    onDragEnd: handleDragEnd,
    initial: { y: vh },
    exit: { y: vh, transition: SPRING_CLOSE },
    style: { height: "100vh" } as React.CSSProperties,
  };

  return { dragControls, isExpanded, sheetProps, handlePointerDownHandle };
}
