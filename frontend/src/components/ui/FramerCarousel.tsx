"use client";
import { animate, motion, useMotionValue } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface CarouselSlide {
  id: string;
  content: React.ReactNode;
}

interface FramerCarouselProps {
  slides: CarouselSlide[];
}

export default function FramerCarousel({ slides }: FramerCarouselProps) {
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const visibleCount = 3;
  const maxIndex = Math.max(0, slides.length - visibleCount);

  useEffect(() => {
    if (containerRef.current) {
      const shift = (containerRef.current.offsetWidth / visibleCount) * index;
      animate(x, -shift, {
        type: "spring",
        stiffness: 300,
        damping: 30,
      });
    }
  }, [index, x, visibleCount]);

  const btnStyle: React.CSSProperties = {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    border: "none",
    background: "#fff",
    color: "#0f172a",
    cursor: "pointer",
    flexShrink: 0,
    transition: "opacity 0.2s, transform 0.2s",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      {/* Left Arrow */}
      <button
        disabled={index === 0}
        onClick={() => setIndex((i) => Math.max(0, i - 1))}
        style={{
          ...btnStyle,
          opacity: index === 0 ? 0.4 : 0.85,
          cursor: index === 0 ? "not-allowed" : "pointer",
        }}
        onMouseEnter={(e) => { if (index > 0) { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "scale(1.1)"; }}}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = index === 0 ? "0.4" : "0.85"; e.currentTarget.style.transform = "scale(1)"; }}
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Carousel track */}
      <div style={{ flex: 1, overflow: "hidden", borderRadius: "12px" }} ref={containerRef}>
        <motion.div style={{ display: "flex", x }}>
          {slides.map((slide) => (
            <div key={slide.id} style={{ minWidth: `${100 / visibleCount}%`, padding: "0 4px" }}>
              {slide.content}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Right Arrow */}
      <button
        disabled={index >= maxIndex}
        onClick={() => setIndex((i) => Math.min(maxIndex, i + 1))}
        style={{
          ...btnStyle,
          opacity: index >= maxIndex ? 0.4 : 0.85,
          cursor: index >= maxIndex ? "not-allowed" : "pointer",
        }}
        onMouseEnter={(e) => { if (index < maxIndex) { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "scale(1.1)"; }}}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = index >= maxIndex ? "0.4" : "0.85"; e.currentTarget.style.transform = "scale(1)"; }}
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Dots */}
      {slides.length > visibleCount && (
        <div style={{ position: "absolute", bottom: "-28px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "8px" }}>
          {Array.from({ length: maxIndex + 1 }).map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              style={{
                height: "8px",
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s",
                padding: 0,
                width: i === index ? "32px" : "8px",
                background: i === index ? "#ffffff" : "rgba(255,255,255,0.4)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
