"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Drawer as DrawerPrimitive } from "vaul"

function Drawer({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

/* The handle across a bottom drawer's top edge, and a real "Close" button (44px, 48 on Android), so a screen reader
   or a switch can dismiss any drawer without finishing what is in it. A drag that starts on the handle and lets go
   there is a drag, not a tap: its click must not also close. Where the pointer went down is kept only until it comes
   up (or the gesture is cancelled), and whether it moved is decided then, so a stale press can never swallow a later
   click. */
function DrawerGrip({ ref }: { ref?: React.Ref<HTMLButtonElement> }) {
  const grab = React.useRef<{ x: number; y: number } | null>(null)
  const dragged = React.useRef(false)
  return (
    <DrawerPrimitive.Close
      ref={ref}
      aria-label="Close"
      data-slot="drawer-grip"
      onPointerDown={(e) => { grab.current = { x: e.clientX, y: e.clientY }; dragged.current = false }}
      onPointerUp={(e) => {
        const g = grab.current
        grab.current = null
        dragged.current = !!g && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 6
      }}
      onPointerCancel={() => { grab.current = null; dragged.current = false }}
      onClick={(e) => {
        const wasDrag = dragged.current
        dragged.current = false
        /* detail 0: a keyboard or a screen reader activated it — no pointer, so nothing to have dragged. */
        if (e.detail !== 0 && wasDrag) e.preventDefault()
      }}
      className="flex min-h-11 w-full flex-none cursor-grab items-center justify-center rounded-t-[24px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset in-data-[platform=android]:min-h-12"
    >
      <span aria-hidden className="h-[5px] w-10 rounded-full bg-border" />
    </DrawerPrimitive.Close>
  )
}

function DrawerContent({
  className,
  children,
  handle = true,
  overlayClassName,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & {
  /** The grip (a Close button) across the top. Off when the caller places its own DrawerGrip (BottomDrawer, to
      hand it focus). */
  handle?: boolean
  /** Classes for the veil behind this drawer (the Add drawer's shorter fade). */
  overlayClassName?: string
}) {
  return (
    <DrawerPortal data-slot="drawer-portal">
      <DrawerOverlay className={overlayClassName} />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "group/drawer-content fixed z-50 flex h-auto flex-col bg-background",
          "data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80vh] data-[vaul-drawer-direction=top]:rounded-b-lg data-[vaul-drawer-direction=top]:border-b",
          "data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[86dvh] data-[vaul-drawer-direction=bottom]:rounded-t-[24px]",
          "data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=right]:sm:max-w-sm",
          "data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=left]:sm:max-w-sm",
          className
        )}
        {...props}
      >
        {handle && <DrawerGrip />}
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-0.5 p-4 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center group-data-[vaul-drawer-direction=top]/drawer-content:text-center md:gap-1.5 md:text-left",
        className
      )}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerGrip,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
