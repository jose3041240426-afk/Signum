"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [direction, setDirection] = useState<"slide-right" | "slide-left" | "slide-up">("slide-right");
  const [animate, setAnimate] = useState(false);
  const [key, setKey] = useState(0);
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (prevPathRef.current === pathname) return;

    const prev = prevPathRef.current;
    const prevDepth = prev.split("/").filter(Boolean).length;
    const currDepth = pathname.split("/").filter(Boolean).length;

    if (currDepth > prevDepth) {
      setDirection("slide-right");
    } else if (currDepth < prevDepth) {
      setDirection("slide-left");
    } else {
      setDirection("slide-up");
    }

    prevPathRef.current = pathname;
    setAnimate(true);
    setKey((k) => k + 1);
  }, [pathname]);

  return (
    <div key={key} className={`page-transition ${animate ? direction : ""}`}>
      {children}
    </div>
  );
}
