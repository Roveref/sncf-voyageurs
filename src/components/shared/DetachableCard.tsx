/**
 * DetachableCard — Wraps any card content. Double-click the top handle to detach
 * into a floating PiP window. Close the PiP to re-attach inline.
 *
 * Usage:
 *   <DetachableCard storageKey="tu-overview" title="TU Overview">
 *     <MyCardContent />
 *   </DetachableCard>
 */

import { memo, useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useWidgetRegistry } from "../../stores/useWidgetRegistry";

/** Context: false when inline, ReactNode (close button) when detached */
const DetachedContext = createContext<false | ReactNode>(false);
/** Hook: returns false when inline, or the close button ReactNode when detached */
export const useIsDetached = () => useContext(DetachedContext);
/** Hook: returns the PiP close button if detached, or null */
export const usePiPCloseButton = () => {
  const v = useContext(DetachedContext);
  return v === false ? null : v;
};
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { alpha, useTheme } from "@mui/material/styles";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PiPWrapper from "./PiPWrapper";

export interface DetachableCardProps {
  /** Unique key for localStorage persistence of PiP position/size */
  storageKey: string;
  /** Title shown in the PiP header when detached */
  title: string;
  /** Optional icon for the PiP header */
  icon?: ReactNode;
  /** Default PiP width */
  defaultWidth?: number;
  /** Default PiP height */
  defaultHeight?: number;
  /** Group label for Custom Dashboard palette (e.g. "Pipeline", "Staffing") */
  group?: string;
  children: ReactNode;
}

const DetachableCard = memo(
  ({ storageKey, title, icon, defaultWidth = 600, defaultHeight = 500, group, children }: DetachableCardProps) => {
    const theme = useTheme();
    const [detached, setDetached] = useState(false);

    const handleDetach = useCallback(() => setDetached(true), []);
    const handleAttach = useCallback(() => setDetached(false), []);

    // Register in widget registry so Custom Dashboard can render this card.
    // Use a ref for children to avoid re-registering on every render.
    const childrenRef = useRef(children);
    childrenRef.current = children;
    const register = useWidgetRegistry((s) => s.register);
    useEffect(() => {
      register(storageKey, title, group || "Autre", () => childrenRef.current);
    }, [storageKey, title, group, register]);

    const closeButton = (
      <IconButton
        size="small"
        onClick={handleAttach}
        sx={{ color: "text.disabled", "&:hover": { color: "text.secondary" }, ml: 1, flexShrink: 0 }}
      >
        <CloseIcon sx={{ fontSize: 18 }} />
      </IconButton>
    );

    if (detached) {
      return (
        <>
          {/* Placeholder where the card was */}
          <Box
            onDoubleClick={handleAttach}
            sx={{
              borderRadius: 3,
              border: `2px dashed ${alpha(theme.palette.text.disabled, 0.15)}`,
              bgcolor: alpha(theme.palette.text.disabled, 0.02),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              py: 3,
              cursor: "pointer",
              transition: "all 0.2s ease",
              "&:hover": {
                borderColor: alpha(theme.palette.primary.main, 0.25),
                bgcolor: alpha(theme.palette.primary.main, 0.03),
              },
            }}
          >
            <OpenInNewIcon sx={{ fontSize: 16, color: "text.disabled", transform: "rotate(180deg)" }} />
            <Typography variant="caption" sx={{ fontSize: "0.78rem", color: "text.disabled", fontWeight: 500 }}>
              {title} — double-clic pour rattacher
            </Typography>
          </Box>

          {/* Floating PiP */}
          <PiPWrapper
            open
            onClose={handleAttach}
            storageKey={storageKey}
            title={title}
            icon={icon}
            defaultWidth={defaultWidth}
            defaultHeight={defaultHeight}
            minHeight={100}
            headless
          >
            <DetachedContext.Provider value={closeButton}>{children}</DetachedContext.Provider>
          </PiPWrapper>
        </>
      );
    }

    // Inline mode — children with a subtle detach handle on top
    return (
      <Box sx={{ position: "relative", height: "100%", "&:hover .detachable-pip-handle": { opacity: 1 } }}>
        {/* Detach handle — subtle icon, visible on parent hover */}
        <Box
          onDoubleClick={handleDetach}
          title="Double-click to detach"
          className="detachable-pip-handle"
          sx={{
            position: "absolute",
            top: 6,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            cursor: "grab",
            opacity: 0,
            "&:active": { cursor: "grabbing" },
            transition: "opacity 0.2s ease",
            width: 24,
            height: 24,
            borderRadius: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: alpha(theme.palette.text.primary, 0.04),
            "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.08), opacity: 1 },
          }}
        >
          <OpenInNewIcon sx={{ fontSize: 13, color: "text.disabled" }} />
        </Box>

        {children}
      </Box>
    );
  }
);
DetachableCard.displayName = "DetachableCard";

export default DetachableCard;
