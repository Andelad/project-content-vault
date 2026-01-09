import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/presentation/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

interface TooltipContentProps extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> {
  backgroundColor?: string;
  textColor?: string;
}

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(({ className, sideOffset = 8, backgroundColor, textColor, style, ...props }, ref) => {
  const bgColor = backgroundColor || 'hsl(var(--popover))';
  const txtColor = textColor || 'hsl(var(--popover-foreground))';
  
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "overflow-visible rounded-md px-3 py-1.5 text-sm animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        style={{
          backgroundColor: bgColor,
          color: txtColor,
          border: '1px solid hsl(var(--border) / 0.5)',
          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))',
          zIndex: 9999,
          ...style
        }}
        {...props}
      >
        {props.children}
        <TooltipPrimitive.Arrow
          width={16}
          height={8}
          asChild
        >
          <svg width="16" height="8" viewBox="0 0 16 8" xmlns="http://www.w3.org/2000/svg">
            {/* Border/stroke triangle - pointing away from tooltip */}
            <path
              d="M 0,0 L 8,8 L 16,0"
              fill="hsl(var(--border) / 0.5)"
            />
            {/* Inner fill triangle - slightly smaller to create border effect */}
            <path
              d="M 1,0 L 8,7 L 15,0"
              fill={bgColor}
            />
          </svg>
        </TooltipPrimitive.Arrow>
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
})
TooltipContent.displayName = TooltipPrimitive.Content.displayName

const TooltipArrow = TooltipPrimitive.Arrow

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
