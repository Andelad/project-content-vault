import { cva, type VariantProps } from "class-variance-authority"

export const badgeVariants = cva(
  "inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive text-destructive-foreground shadow-sm",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export type BadgeVariantProps = VariantProps<typeof badgeVariants>
