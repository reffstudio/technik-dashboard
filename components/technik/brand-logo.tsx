"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import { useTheme } from "next-themes"

/**
 * Logos oficiales Technik Solutions
 * - Dark:  technik cyan (#00D9EA) + SOLUTIONS blanco
 * - Light: misma marca sobre placa navy (#141C28) para contraste
 *
 * Brand: #00D9EA · #141C28 · #FFFFFF
 */
export function BrandLogo({
  className = "",
  height = 28,
  priority = false,
}: {
  className?: string
  height?: number
  priority?: boolean
}) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = !mounted || (resolvedTheme ?? "dark") === "dark"
  const width = Math.round(height * (1024 / 348))

  if (isDark) {
    return (
      <div className={`relative ${className}`} style={{ height, width }}>
        <Image
          src="/brand/technik-logo-dark.png"
          alt="Technik Solutions"
          fill
          priority={priority}
          className="object-contain object-left"
          sizes={`${width}px`}
        />
      </div>
    )
  }

  return (
    <div
      className={`relative rounded-lg bg-[var(--brand-navy)] px-2.5 py-1 ${className}`}
      style={{ height: height + 8, width: width + 20 }}
    >
      <Image
        src="/brand/technik-logo-dark.png"
        alt="Technik Solutions"
        fill
        priority={priority}
        className="object-contain object-left p-1"
        sizes={`${width}px`}
      />
    </div>
  )
}
