import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/85",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/85",
        success: "border-transparent bg-success text-success-foreground shadow-xs hover:bg-success/85",
        warning: "border-transparent bg-warning text-warning-foreground shadow-xs hover:bg-warning/85",
        info: "border-transparent bg-info text-info-foreground shadow-xs hover:bg-info/85",
        outline: "text-foreground border-border",
        // Soft variants — مناسبة لـ Bold & Dense دون ضوضاء
        "soft-primary": "pill-info bg-primary/10 text-primary border-primary/25",
        "soft-success": "pill-success",
        "soft-warning": "pill-warning",
        "soft-destructive": "pill-destructive",
        "soft-info": "pill-info",
        "soft-muted": "pill-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
