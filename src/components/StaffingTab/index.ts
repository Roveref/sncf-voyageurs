import React from "react";
import StaffingTab from "./StaffingTab";

const MemoizedStaffingTab = React.memo(StaffingTab);
MemoizedStaffingTab.displayName = "StaffingTab";
export default MemoizedStaffingTab;
