"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { LayoutGroup, motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

/** Context to share a unique layoutId per TabsList instance */
const TabsLayoutContext = React.createContext<string>("tab-indicator")

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      className={cn("w-full", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const layoutId = React.useId()
  return (
    <TabsLayoutContext.Provider value={layoutId}>
      <LayoutGroup>
        <TabsPrimitive.List
          className={cn(
            "inline-flex h-10 items-center justify-center rounded-xl bg-muted/60 p-1 gap-0.5 text-muted-foreground dark:bg-muted/40",
            className
          )}
          {...props}
        />
      </LayoutGroup>
    </TabsLayoutContext.Provider>
  )
}

function TabsTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const layoutId = React.useContext(TabsLayoutContext)
  const ref = React.useRef<HTMLButtonElement>(null)
  const [isActive, setIsActive] = React.useState(false)
  const prefersReducedMotion = useReducedMotion()

  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new MutationObserver(() => {
      setIsActive(el.getAttribute("data-state") === "active")
    })
    setIsActive(el.getAttribute("data-state") === "active")
    observer.observe(el, { attributes: true, attributeFilter: ["data-state"] })
    return () => observer.disconnect()
  }, [])

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "relative inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium text-muted-foreground cursor-pointer focus-visible:outline-none focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground hover:text-foreground/70 transition-colors",
        className
      )}
      {...props}
    >
      {isActive && (
        prefersReducedMotion ? (
          <div className="absolute inset-0 rounded-lg bg-background shadow-sm dark:shadow-none dark:ring-1 dark:ring-border/50" />
        ) : (
          <motion.div
            layoutId={layoutId}
            className="absolute inset-0 rounded-lg bg-background shadow-sm dark:shadow-none dark:ring-1 dark:ring-border/50"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )
      )}
      <span className="relative z-10">{children}</span>
    </TabsPrimitive.Trigger>
  )
}

function TabsContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <TabsPrimitive.Content
      className={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    >
      {prefersReducedMotion ? (
        <div>{children}</div>
      ) : (
        <motion.div
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
        >
          {children}
        </motion.div>
      )}
    </TabsPrimitive.Content>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
