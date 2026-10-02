"use client";

import React, { useMemo } from "react";
import { generateQrMatrix } from "@/lib/qr-code";

interface QrCodeSvgProps {
  value: string;
  size?: number;
  className?: string;
  fgColor?: string;
  bgColor?: string;
}

export function QrCodeSvg({
  value,
  size = 160,
  className = "",
  fgColor = "#0F1117",
  bgColor = "#FFFFFF",
}: QrCodeSvgProps) {
  const matrix = useMemo(() => {
    try {
      return generateQrMatrix(value);
    } catch {
      return [];
    }
  }, [value]);

  if (!matrix.length) return null;

  const margin = 2;
  const viewBoxSize = matrix.length + margin * 2;

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center p-2 rounded-2xl bg-white shadow-md ${className}`}
    >
      <svg
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="crispEdges"
      >
        <rect width="100%" height="100%" fill={bgColor} />
        {matrix.map((row, r) =>
          row.map((cell, c) =>
            cell ? (
              <rect
                key={`${r}-${c}`}
                x={c + margin}
                y={r + margin}
                width={1.02}
                height={1.02}
                fill={fgColor}
              />
            ) : null
          )
        )}
      </svg>
    </div>
  );
}
