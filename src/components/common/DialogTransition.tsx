import React from "react";
import Slide from "@mui/material/Slide";
import type { TransitionProps } from "@mui/material/transitions";

/**
 * Enhanced dialog transition: slide up + scale in.
 * Use as: <Dialog TransitionComponent={DialogTransition} ...>
 */
const DialogTransition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default DialogTransition;
