"use client"

import { useEffect, useRef } from "react"

interface LightSpot {
  x: number
  y: number
  radius: number
  color: string
  opacity: number
  speedX: number
  speedY: number
}

const COLORS = ["#4da6ff", "#7c5cfc", "#ff6b9d", "#43e97b", "#f7971e"]

export function LightPoints() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationId: number
    let spots: LightSpot[] = []

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    function init() {
      spots = Array.from({ length: 8 }, () => ({
        x: Math.random() * canvas!.width,
        y: Math.random() * canvas!.height,
        radius: Math.random() * 300 + 200,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        opacity: Math.random() * 0.08 + 0.03,
        speedX: (Math.random() - 0.5) * 0.2,
        speedY: (Math.random() - 0.5) * 0.2,
      }))
    }

    function draw() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const s of spots) {
        s.x += s.speedX
        s.y += s.speedY

        if (s.x < -s.radius) s.x = canvas.width + s.radius
        if (s.x > canvas.width + s.radius) s.x = -s.radius
        if (s.y < -s.radius) s.y = canvas.height + s.radius
        if (s.y > canvas.height + s.radius) s.y = -s.radius

        const gradient = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.radius)
        gradient.addColorStop(0, s.color + Math.round(s.opacity * 255).toString(16).padStart(2, "0"))
        gradient.addColorStop(0.5, s.color + Math.round(s.opacity * 0.5 * 255).toString(16).padStart(2, "0"))
        gradient.addColorStop(1, s.color + "00")

        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      animationId = requestAnimationFrame(draw)
    }

    resize()
    init()
    animationId = requestAnimationFrame(draw)

    window.addEventListener("resize", () => {
      resize()
      init()
    })

    return () => cancelAnimationFrame(animationId)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        width: "100vw",
        height: "100vh",
      }}
    />
  )
}
