"use client";

import { LiquidGradientCanvas } from "@/components/ui/liquid-gradient";

export function FluidBackground() {
  return (
    <LiquidGradientCanvas
      colors={["#020b1a", "#051f3d", "#0a3d6b", "#1e6bb8", "#4a9eff"]}
      speed={0.5}
      scale={0.55}
      seed={15}
      turbAmp={0.45}
      turbFreq={0.7}
      turbIter={9}
      waveFreq={2.0}
      distBias={0.05}
      ditherMode="smooth"
      dither={0.05}
      exposure={1.15}
      contrast={1.1}
      saturation={1.15}
      className="fixed inset-0 -z-1 h-full w-full"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: -1,
        display: "block",
      }}
    />
  );
}
