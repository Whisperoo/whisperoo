import * as React from "react"
import { cn } from "@/lib/utils"

const FeatureCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl gradient-brand text-white p-6 shadow-elevated",
      className
    )}
    {...props}
  />
))
FeatureCard.displayName = "FeatureCard"

const FeatureCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 pb-4", className)}
    {...props}
  />
))
FeatureCardHeader.displayName = "FeatureCardHeader"

const FeatureCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xl font-bold leading-tight text-white",
      className
    )}
    {...props}
  />
))
FeatureCardTitle.displayName = "FeatureCardTitle"

const FeatureCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-white/90 leading-relaxed", className)}
    {...props}
  />
))
FeatureCardDescription.displayName = "FeatureCardDescription"

const FeatureCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("", className)} {...props} />
))
FeatureCardContent.displayName = "FeatureCardContent"

const FeatureCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-4", className)}
    {...props}
  />
))
FeatureCardFooter.displayName = "FeatureCardFooter"

export { 
  FeatureCard, 
  FeatureCardHeader, 
  FeatureCardFooter, 
  FeatureCardTitle, 
  FeatureCardDescription, 
  FeatureCardContent 
}