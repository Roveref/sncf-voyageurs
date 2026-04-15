import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

export interface ResponsiveState {
  /** < 600px — smartphones */
  isPhone: boolean;
  /** 600-899px — tablets, small laptops portrait */
  isTablet: boolean;
  /** >= 900px — current desktop layout */
  isDesktop: boolean;
  /** Coarse pointer (finger) vs fine (mouse) — true on touch-primary devices */
  isTouchDevice: boolean;
}

/**
 * Centralised responsive breakpoint hook.
 * Replaces the single `isMobile` boolean from App.tsx with three tiers.
 */
const useResponsive = (): ResponsiveState => {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const isTouchDevice = useMediaQuery("(pointer: coarse)");
  return { isPhone, isTablet, isDesktop, isTouchDevice };
};

export default useResponsive;
