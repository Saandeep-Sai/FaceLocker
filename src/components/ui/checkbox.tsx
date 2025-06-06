"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
    variant?: "default" | "rounded" | "minimal";
  }
>(({ className, variant = "default", ...props }, ref) => {
  const variantStyles = {
    default: "border-blue-600 dark:border-blue-500 data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500",
    rounded: "rounded-full border-blue-600 dark:border-blue-500 data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500",
    minimal: "border-gray-300 dark:border-gray-600 data-[state=checked]:bg-gray-200 dark:data-[state=checked]:bg-gray-700",
  };

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer h-5 w-5 shrink-0 border-2 ring-offset-2 transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:text-white",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn("flex items-center justify-center text-current")}
      >
        <Check className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };