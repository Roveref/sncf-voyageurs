/**
 * OpportunityPopup — Dialog showing OpportunityExpandedDetails for a selected opportunity.
 */

import React, { memo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../common/DialogTransition";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import OpportunityExpandedDetails from "../OpportunityList/components/OpportunityExpandedDetails";

interface OpportunityPopupProps {
  selectedOpportunity: any;
  onClose: () => void;
  showNetRevenue: boolean;
  showIO: any;
  setEditOpportunity?: (opp: any) => void;
  onManualOpportunityUpdated?: (opp: any) => void;
  initialActionsTab?: any;
  /** Called when the user clicks Edit from inside the popup — closes both popup and parent dialog */
  onEditFromPopup?: (opp: any) => void;
}

const OpportunityPopup = memo(
  ({
    selectedOpportunity,
    onClose,
    showNetRevenue,
    showIO,
    onEditFromPopup,
    onManualOpportunityUpdated,
    initialActionsTab,
  }: OpportunityPopupProps) => {
    const theme = useTheme();

    return (
      <Dialog
        open={!!selectedOpportunity}
        onClose={onClose}
        TransitionComponent={DialogTransition}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: "90vh",
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          }}
        >
          <Typography variant="h6" fontWeight={600}>
            {selectedOpportunity?.opportunity || "Opportunity Details"}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {selectedOpportunity && (
            <Box sx={{ p: 2 }}>
              <OpportunityExpandedDetails
                row={selectedOpportunity}
                showNetRevenue={showNetRevenue}
                showIO={showIO}
                setEditOpportunity={onEditFromPopup}
                onManualOpportunityUpdated={onManualOpportunityUpdated}
                initialActionsTab={initialActionsTab}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Button onClick={onClose} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
);

OpportunityPopup.displayName = "OpportunityPopup";

export default OpportunityPopup;
