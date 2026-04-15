/**
 * Custom Recharts Bar shapes that round corners only on the last non-zero segment of a stack.
 *
 * roundedBarShape(stackKeys)     — horizontal bars, rounds RIGHT side
 * roundedBarShapeTop(stackKeys)  — vertical bars, rounds TOP side
 *
 * Corner radius is always R=8, regardless of segment size.
 */

import type { ReactElement } from "react";

const R = 8;

/** SVG path for a rect with only the right side rounded (fixed radius R) */
function rightRoundedPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(R, w, h / 2);
  return `M${x},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x}Z`;
}

/** SVG path for a rect with only the top side rounded (fixed radius R) */
function topRoundedPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(R, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Horizontal stacked bars — round right side of the last non-zero segment */
export function roundedBarShape(stackKeys: string[]) {
  return (props: any): ReactElement | null => {
    const { x, y, width, height, fill, fillOpacity, opacity, payload, dataKey } = props;
    if (!width || !height || width <= 0 || height <= 0) return null;

    const idx = stackKeys.indexOf(dataKey);
    const isLastNonZero = stackKeys.slice(idx + 1).every((k) => !payload[k]);

    if (!isLastNonZero) {
      return (
        <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity={fillOpacity} opacity={opacity ?? 1} />
      );
    }

    return (
      <path d={rightRoundedPath(x, y, width, height)} fill={fill} fillOpacity={fillOpacity} opacity={opacity ?? 1} />
    );
  };
}

/** Vertical stacked bars — round top side of the last non-zero segment */
export function roundedBarShapeTop(stackKeys: string[]) {
  return (props: any): ReactElement | null => {
    const { x, y, width, height, fill, fillOpacity, opacity, payload, dataKey } = props;
    if (!width || !height || width <= 0 || height <= 0) return null;

    const idx = stackKeys.indexOf(dataKey);
    const isLastNonZero = stackKeys.slice(idx + 1).every((k) => !payload[k]);

    if (!isLastNonZero) {
      return (
        <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity={fillOpacity} opacity={opacity ?? 1} />
      );
    }

    return (
      <path d={topRoundedPath(x, y, width, height)} fill={fill} fillOpacity={fillOpacity} opacity={opacity ?? 1} />
    );
  };
}
