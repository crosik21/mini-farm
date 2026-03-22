import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"

interface DrawerModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  icon?: React.ReactNode
}

export function DrawerModal({ isOpen, onClose, title, children, icon }: DrawerModalProps) {
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
          
          {/* Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-x-0 bottom-0 z-50 mt-24 flex h-[85vh] flex-col rounded-t-[2rem] bg-card border-t-4 border-card-border shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-border/50 bg-muted/30 rounded-t-[1.8rem]">
              <div className="flex items-center gap-3">
                {icon && <div className="text-2xl">{icon}</div>}
                <h2 className="text-2xl font-display font-bold text-foreground">{title}</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-full bg-muted p-2 hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <X className="h-6 w-6" />
                <span className="sr-only">Закрыть</span>
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 hide-scrollbar">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
