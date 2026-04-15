import React, { memo } from "react";
import Typography from "@mui/material/Typography";
import { useAnimatedNumber } from "../../hooks/useAnimatedNumber";
import { formatCurrency } from "../../utils/formatters";

/**
 * Animated currency — counts up and formats with formatCurrency.
 * Drop-in replacement for: <Typography>{formatCurrency(value)}</Typography>
 */
export const AnimatedCurrency = memo(
  ({
    value,
    variant = "h4",
    color = "text.primary",
    fontWeight = 700,
    sx = {},
  }: {
    value: number;
    variant?: any;
    color?: string;
    fontWeight?: number;
    sx?: any;
  }) => {
    const animated = useAnimatedNumber(value, 800, 0);
    return (
      <Typography variant={variant} component="span" fontWeight={fontWeight} color={color} sx={sx}>
        {formatCurrency(animated)}
      </Typography>
    );
  }
);
AnimatedCurrency.displayName = "AnimatedCurrency";

/**
 * Animated integer count — counts up to target.
 * Drop-in replacement for: <Typography>{count}</Typography>
 */
export const AnimatedCount = memo(
  ({
    value,
    variant = "h4",
    color = "text.primary",
    fontWeight = 700,
    suffix = "",
    sx = {},
  }: {
    value: number;
    variant?: any;
    color?: string;
    fontWeight?: number;
    suffix?: string;
    sx?: any;
  }) => {
    const animated = useAnimatedNumber(value, 600, 0);
    return (
      <Typography variant={variant} component="span" fontWeight={fontWeight} color={color} sx={sx}>
        {animated}
        {suffix}
      </Typography>
    );
  }
);
AnimatedCount.displayName = "AnimatedCount";

/**
 * Animated percentage — counts up with 1 decimal + % suffix.
 * Drop-in replacement for: <Typography>{value.toFixed(0)}%</Typography>
 */
export const AnimatedPercent = memo(
  ({
    value,
    variant = "h5",
    color = "text.primary",
    fontWeight = 700,
    decimals = 0,
    sx = {},
  }: {
    value: number;
    variant?: any;
    color?: string;
    fontWeight?: number;
    decimals?: number;
    sx?: any;
  }) => {
    const animated = useAnimatedNumber(value, 600, decimals);
    return (
      <Typography variant={variant} component="span" fontWeight={fontWeight} color={color} sx={sx}>
        {animated}%
      </Typography>
    );
  }
);
AnimatedPercent.displayName = "AnimatedPercent";
