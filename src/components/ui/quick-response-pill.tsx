import * as React from "react"
import { cn } from "@/lib/utils"

interface QuickResponsePillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

const QuickResponsePill = React.forwardRef<HTMLButtonElement, QuickResponsePillProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-800 transition-all duration-200 hover:border-brand-primary hover:bg-brand-light hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    )
  }
)
QuickResponsePill.displayName = "QuickResponsePill"

export { QuickResponsePill }