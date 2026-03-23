import * as React from "react"
import { motion, AnimatePresence, useDragControls } from "framer-motion"
import { X } from "lucide-react"

interface DrawerModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  icon?: React.ReactNode
  maxHeight?: string
}

export function DrawerModal({ isOpen, onClose, title, children, icon, maxHeight = "85vh" }: DrawerModalProps) {
  const dragControls = useDragControls()

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.12, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 260) onClose()
            }}
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[2rem] bg-card border-t-4 border-card-border shadow-2xl"
            style={{ maxHeight }}
          >
            {/* Drag handle — only this initiates the sheet-swipe gesture */}
            <div
              className="flex justify-center pt-3 pb-1 flex-shrink-0 touch-none cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => { e.stopPropagation(); dragControls.start(e) }}
            >
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b-2 border-border/50 bg-muted/30 flex-shrink-0">
              <div className="flex items-center gap-3">
                {icon && <div className="text-2xl">{icon}</div>}
                <h2 className="text-2xl font-display font-bold text-foreground">{title}</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-full bg-muted p-2 hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Закрыть</span>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 hide-scrollbar" style={{ touchAction: "pan-y" }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
