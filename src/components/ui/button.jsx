import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "../../lib/utils"

const Button = React.forwardRef(({ className, asChild = false, type = "button", ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      type={type}
      className={cn(
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button }
