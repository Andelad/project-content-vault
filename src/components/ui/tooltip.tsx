import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-visible rounded-md bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-lg border border-border/50 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      "relative",
      className
    )}
    {...props}
  >
    {props.children}
    <style dangerouslySetInnerHTML={{
      __html: `
        .tooltip-content::before {
          content: '';
          position: absolute;
          width: 0;
          height: 0;
          border: 6px solid transparent;
          border-radius: 1px;
        }
        
        /* Top arrow (tooltip below trigger) */
        [data-side="top"]::before {
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-top-color: hsl(var(--popover));
          border-bottom: none;
        }
        
        /* Bottom arrow (tooltip above trigger) */
        [data-side="bottom"]::before {
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-bottom-color: hsl(var(--popover));
          border-top: none;
        }
        
        /* Left arrow (tooltip to right of trigger) */
        [data-side="left"]::before {
          left: 100%;
          top: 50%;
          transform: translateY(-50%);
          border-left-color: hsl(var(--popover));
          border-right: none;
        }
        
        /* Right arrow (tooltip to left of trigger) */
        [data-side="right"]::before {
          right: 100%;
          top: 50%;
          transform: translateY(-50%);
          border-right-color: hsl(var(--popover));
          border-left: none;
        }
      `
    }} />
  </TooltipPrimitive.Content>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

const TooltipArrow = TooltipPrimitive.Arrow

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
