import { useState, useRef, useCallback } from "react";
import { useUserDataStore } from "../../stores/useUserDataStore";
import { getStatusLabel } from "../../utils/statusOptions";
import { formatCurrency } from "../../utils/formatters";
import type { OpportunityAction } from "../../types/actions";

const formatDateShort = (isoString: string | null): string => {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

/** Common fields for import comparison items */
interface ImportComparisonItem {
  [key: string]: unknown;
}

interface ImportResultDetails {
  statusOverrides: {
    created: ImportComparisonItem[];
    updated: ImportComparisonItem[];
    skipped: ImportComparisonItem[];
  };
  manualOpportunities: {
    created: ImportComparisonItem[];
    updated: ImportComparisonItem[];
    skipped: ImportComparisonItem[];
  };
  manualAccounts: { created: ImportComparisonItem[]; skipped: ImportComparisonItem[] };
  actionsComments: {
    actions: { created: ImportComparisonItem[]; updated: ImportComparisonItem[]; skipped: ImportComparisonItem[] };
  };
}

interface ImportResult {
  success: boolean;
  error: string | null;
  details: ImportResultDetails | null;
}

/** Status override record */
interface StatusOverrideRecord {
  opportunityId: string;
  originalStatus: number;
  newStatus: number;
  comment?: string;
  modifiedAt?: string;
  [key: string]: unknown;
}

/** Manual opportunity record */
interface ManualOpportunityRecord {
  opportunityId: string;
  opportunity?: string;
  account?: string;
  status: number;
  grossRevenue?: number;
  netRevenue?: number;
  manager?: string;
  em?: string;
  [key: string]: unknown;
}

/** Manual account record */
interface ManualAccountRecord {
  account: string;
  subSegmentCode?: string;
  subSegment?: string;
  country?: string;
  parentAccount?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/** CRM opportunity from pipeline map */
interface OpportunityMapEntry {
  opportunity?: string;
  account?: string;
  manager?: string;
  em?: string;
  status?: number;
  grossRevenue?: number;
  [key: string]: unknown;
}

interface UseImportExportParams {
  getAllOverrides: StatusOverrideRecord[];
  manualOpportunities: ManualOpportunityRecord[];
  manualAccounts: ManualAccountRecord[];
  opportunityMap: Record<string, OpportunityMapEntry>;
  overrideCount: number;
  manualCount: number;
  accountCount: number;
  totalCount: number;
  setStatusOverride: (opportunityId: string, originalStatus: number, newStatus: number, comment: string) => void;
  onManualOpportunityUpdated?: (opp: ManualOpportunityRecord) => void;
  onAddManualOpportunity?: (opp: ManualOpportunityRecord) => void;
  onAddManualAccount?: (acc: ManualAccountRecord) => void;
}

interface UseImportExportReturn {
  importResult: ImportResult | null;
  setImportResult: React.Dispatch<React.SetStateAction<ImportResult | null>>;
  isImporting: boolean;
  copied: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleCopyReport: () => Promise<void>;
  handleDownloadReport: () => void;
  handleExportJSON: () => void;
  handleImportFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Hook encapsulating all import/export logic for the StatusOverrideManager.
 * Handles: JSON export, JSON import with comparison, text report generation,
 * clipboard copy, and file download.
 */
export function useImportExport({
  getAllOverrides,
  manualOpportunities,
  manualAccounts,
  opportunityMap,
  overrideCount,
  manualCount,
  accountCount,
  totalCount,
  setStatusOverride,
  onManualOpportunityUpdated,
  onAddManualOpportunity,
  onAddManualAccount,
}: UseImportExportParams): UseImportExportReturn {
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Generate report content as table format
  const generateReportContent = useCallback((): string => {
    const today = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    let report = `ACTION ITEMS REPORT - ${today}\n`;
    report += `${"=".repeat(120)}\n\n`;

    // Summary
    report += `SUMMARY\n`;
    report += `${"-".repeat(40)}\n`;
    report += `• Statuses to modify in CRM: ${overrideCount}\n`;
    report += `• Opportunities to create in CRM: ${manualCount}\n`;
    report += `• Accounts to create in CRM: ${accountCount}\n`;
    report += `• Total actions: ${totalCount}\n\n`;

    // Status overrides section as table
    if (overrideCount > 0) {
      report += `\n${"=".repeat(120)}\n`;
      report += `STATUSES TO MODIFY IN CRM\n`;
      report += `${"=".repeat(120)}\n\n`;

      const col1 = "Opportunity".padEnd(35);
      const col2 = "Account".padEnd(20);
      const col3 = "Manager".padEnd(20);
      const col4 = "Action".padEnd(25);
      const col5 = "Amount".padEnd(15);
      report += `${col1} | ${col2} | ${col3} | ${col4} | ${col5}\n`;
      report += `${"-".repeat(35)} | ${"-".repeat(20)} | ${"-".repeat(20)} | ${"-".repeat(25)} | ${"-".repeat(15)}\n`;

      getAllOverrides.forEach((override) => {
        const opportunity = opportunityMap[override.opportunityId];
        const oppName = (String(String(opportunity?.opportunity || "") || "") || override.opportunityId)
          .substring(0, 33)
          .padEnd(35);
        const account = String(opportunity?.account || "-")
          .substring(0, 18)
          .padEnd(20);
        const manager = (opportunity?.manager || opportunity?.em || "-").substring(0, 18).padEnd(20);
        const action = `${getStatusLabel(override.originalStatus)} → ${getStatusLabel(override.newStatus)}`.padEnd(25);
        const revenue = formatCurrency(Number(opportunity?.grossRevenue || 0) || 0).padEnd(15);

        report += `${oppName} | ${account} | ${manager} | ${action} | ${revenue}\n`;
      });

      report += `\n`;
    }

    // Manual opportunities section as table
    if (manualCount > 0) {
      report += `\n${"=".repeat(120)}\n`;
      report += `OPPORTUNITIES TO CREATE IN CRM\n`;
      report += `${"=".repeat(120)}\n\n`;

      const col1 = "Opportunity".padEnd(35);
      const col2 = "Account".padEnd(20);
      const col3 = "Manager".padEnd(20);
      const col4 = "Status".padEnd(15);
      const col5 = "Amount".padEnd(15);
      report += `${col1} | ${col2} | ${col3} | ${col4} | ${col5}\n`;
      report += `${"-".repeat(35)} | ${"-".repeat(20)} | ${"-".repeat(20)} | ${"-".repeat(15)} | ${"-".repeat(15)}\n`;

      manualOpportunities.forEach((opp) => {
        const oppName = String(opp.opportunity || opp.opportunityId)
          .substring(0, 33)
          .padEnd(35);
        const account = String(opp.account || "-")
          .substring(0, 18)
          .padEnd(20);
        const manager = (opp.manager || opp.em || "-").substring(0, 18).padEnd(20);
        const status = getStatusLabel(opp.status).padEnd(15);
        const revenue = formatCurrency(Number(opp.grossRevenue || 0)).padEnd(15);

        report += `${oppName} | ${account} | ${manager} | ${status} | ${revenue}\n`;
      });

      report += `\n`;
    }

    // Accounts to create section
    if (accountCount > 0) {
      report += `\n${"=".repeat(120)}\n`;
      report += `ACCOUNTS TO CREATE IN CRM\n`;
      report += `${"=".repeat(120)}\n\n`;

      const col1 = "Account Name".padEnd(30);
      const col2 = "Parent Account".padEnd(25);
      const col3 = "Segment".padEnd(10);
      const col4 = "Sub-Segment".padEnd(20);
      const col5 = "Country".padEnd(15);
      report += `${col1} | ${col2} | ${col3} | ${col4} | ${col5}\n`;
      report += `${"-".repeat(30)} | ${"-".repeat(25)} | ${"-".repeat(10)} | ${"-".repeat(20)} | ${"-".repeat(15)}\n`;

      manualAccounts.forEach((acc) => {
        const name = (acc.account || "-").substring(0, 28).padEnd(30);
        const parent = (acc.parentAccount || "-").substring(0, 23).padEnd(25);
        const segment = String(acc.subSegmentCode || "-")
          .substring(0, 8)
          .padEnd(10);
        const subSeg = String(acc.subSegment || "-")
          .substring(0, 18)
          .padEnd(20);
        const country = (acc.country || "-").substring(0, 13).padEnd(15);
        report += `${name} | ${parent} | ${segment} | ${subSeg} | ${country}\n`;
      });

      report += `\n`;
    }

    // Actions checklist by manager
    report += `\n${"=".repeat(120)}\n`;
    report += `ACTIONS BY MANAGER\n`;
    report += `${"=".repeat(120)}\n\n`;

    const actionsByManager: Record<
      string,
      {
        overrides: { name: string; from: string; to: string }[];
        creates: { name: string; account: string; status: string }[];
      }
    > = {};

    getAllOverrides.forEach((override) => {
      const opportunity = opportunityMap[override.opportunityId];
      const manager = opportunity?.manager || opportunity?.em || "Unassigned";
      if (!actionsByManager[manager]) {
        actionsByManager[manager] = { overrides: [], creates: [] };
      }
      actionsByManager[manager].overrides.push({
        name: String(String(opportunity?.opportunity || "") || "") || override.opportunityId,
        from: getStatusLabel(override.originalStatus),
        to: getStatusLabel(override.newStatus),
      });
    });

    manualOpportunities.forEach((opp) => {
      const manager = opp.manager || opp.em || "Unassigned";
      if (!actionsByManager[manager]) {
        actionsByManager[manager] = { overrides: [], creates: [] };
      }
      actionsByManager[manager].creates.push({
        name: String(opp.opportunity || opp.opportunityId || ""),
        account: String(opp.account || ""),
        status: getStatusLabel(opp.status ?? 0),
      });
    });

    Object.keys(actionsByManager)
      .sort()
      .forEach((manager) => {
        const actions = actionsByManager[manager];
        const totalActions = actions.overrides.length + actions.creates.length;

        report += `\n► ${manager} (${totalActions} action${totalActions > 1 ? "s" : ""})\n`;
        report += `${"-".repeat(60)}\n`;

        if (actions.overrides.length > 0) {
          report += `  Statuses to modify:\n`;
          actions.overrides.forEach((a) => {
            report += `    □ ${a.name}: ${a.from} → ${a.to}\n`;
          });
        }

        if (actions.creates.length > 0) {
          report += `  Opportunities to create:\n`;
          actions.creates.forEach((a) => {
            report += `    □ ${a.name} (${a.account}) - ${a.status}\n`;
          });
        }
      });

    report += `\n${"=".repeat(120)}\n`;
    report += `Generated from GAIF Pilot - ${today}\n`;

    return report;
  }, [
    getAllOverrides,
    manualOpportunities,
    manualAccounts,
    opportunityMap,
    overrideCount,
    manualCount,
    accountCount,
    totalCount,
  ]);

  // Copy report to clipboard
  const handleCopyReport = useCallback(async (): Promise<void> => {
    const report = generateReportContent();
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy report:", err);
    }
  }, [generateReportContent]);

  // Download report as text file
  const handleDownloadReport = useCallback((): void => {
    const report = generateReportContent();
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const today = new Date().toISOString().split("T")[0];
    link.download = `modifications-report-${today}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [generateReportContent]);

  // Generate export data as JSON
  const generateExportData = useCallback(() => {
    const allActions: { opportunityId: string; [key: string]: unknown }[] = [];

    const { opportunityActions } = useUserDataStore.getState();
    Object.entries(opportunityActions).forEach(([opportunityId, actions]) => {
      actions.forEach((action) => {
        allActions.push({
          opportunityId: action.opportunityId || opportunityId,
          opportunityName: action.opportunityName || "",
          id: action.id,
          owner: action.owner,
          description: action.description,
          dueDate: action.dueDate,
          priority: action.priority,
          status: action.status,
          createdAt: action.createdAt,
        });
      });
    });

    return {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      statusOverrides: getAllOverrides.map((override) => ({
        opportunityId: override.opportunityId,
        originalStatus: override.originalStatus,
        newStatus: override.newStatus,
        comment: override.comment || "",
        modifiedAt: override.modifiedAt,
      })),
      manualOpportunities: manualOpportunities.map((opp) => ({
        ...opp,
        exportedAt: new Date().toISOString(),
      })),
      manualAccounts: manualAccounts.map((acc) => ({
        account: acc.account,
        subSegmentCode: acc.subSegmentCode || "",
        subSegment: acc.subSegment || "",
        country: acc.country || "",
        parentAccount: acc.parentAccount || "",
        createdAt: acc.createdAt || new Date().toISOString(),
      })),
      actionsComments: {
        actions: allActions,
      },
    };
  }, [getAllOverrides, manualOpportunities, manualAccounts]);

  // Download export as JSON file
  const handleExportJSON = useCallback((): void => {
    const exportData = generateExportData();
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const today = new Date().toISOString().split("T")[0];
    link.download = `dashboard-changes-${today}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [generateExportData]);

  // Process imported data with status comparison logic
  const processImport = useCallback(
    (importData: {
      statusOverrides?: StatusOverrideRecord[];
      manualOpportunities?: ManualOpportunityRecord[];
      manualAccounts?: ManualAccountRecord[];
      actionsComments?: { actions?: Record<string, unknown>[] };
    }): void => {
      const results: ImportResultDetails = {
        statusOverrides: { created: [], updated: [], skipped: [] },
        manualOpportunities: { created: [], updated: [], skipped: [] },
        manualAccounts: { created: [], skipped: [] },
        actionsComments: {
          actions: { created: [], updated: [], skipped: [] },
        },
      };

      // Process status overrides
      if (importData.statusOverrides && Array.isArray(importData.statusOverrides)) {
        importData.statusOverrides.forEach((override) => {
          const existingOpp = opportunityMap[override.opportunityId];

          const importedData = {
            originalStatus: getStatusLabel(override.originalStatus),
            newStatus: getStatusLabel(override.newStatus),
            newStatusCode: override.newStatus,
            comment: override.comment || "-",
          };

          if (existingOpp) {
            const currentCRMStatus = existingOpp.status ?? 0;

            const existingData = {
              status: getStatusLabel(currentCRMStatus),
              statusCode: currentCRMStatus,
              account: existingOpp.account || "-",
              revenue: formatCurrency(Number(existingOpp.grossRevenue)),
            };

            const isCRMMoreAdvanced =
              currentCRMStatus >= override.newStatus || currentCRMStatus === 14 || currentCRMStatus === 15;

            if (isCRMMoreAdvanced && currentCRMStatus !== override.originalStatus) {
              results.statusOverrides.skipped.push({
                opportunityId: override.opportunityId,
                opportunityName: existingOpp.opportunity || override.opportunityId,
                existing: existingData,
                imported: importedData,
                decision: "skipped",
                reason:
                  currentCRMStatus === 14
                    ? "CRM status is already Booked (final state)"
                    : currentCRMStatus === 15
                      ? "CRM status is already Lost (final state)"
                      : `CRM status (${getStatusLabel(currentCRMStatus)}) is more advanced`,
              });
            } else {
              setStatusOverride(
                override.opportunityId,
                override.originalStatus,
                override.newStatus,
                override.comment || ""
              );
              results.statusOverrides.updated.push({
                opportunityId: override.opportunityId,
                opportunityName: existingOpp.opportunity || override.opportunityId,
                existing: existingData,
                imported: importedData,
                decision: "updated",
                reason: "Status override applied",
              });
            }
          } else {
            results.statusOverrides.skipped.push({
              opportunityId: override.opportunityId,
              opportunityName: override.opportunityId,
              existing: null,
              imported: importedData,
              decision: "skipped",
              reason: "Opportunity not found in current data",
            });
          }
        });
      }

      // Process manual opportunities
      if (importData.manualOpportunities && Array.isArray(importData.manualOpportunities)) {
        importData.manualOpportunities.forEach((opp) => {
          const opportunityId = opp.opportunityId;
          const oppName = opp.opportunity || opportunityId;

          const importedData = {
            name: oppName,
            account: opp.account || "-",
            status: getStatusLabel(opp.status),
            statusCode: opp.status,
            revenue: formatCurrency(Number(opp.grossRevenue)),
            manager: opp.manager || opp.em || "-",
          };

          const existingManual = manualOpportunities.find((m) => m.opportunityId === opportunityId);

          if (existingManual) {
            const existingStatus = existingManual.status;
            const importStatus = opp.status;

            const existingData = {
              name: existingManual.opportunity || opportunityId,
              account: existingManual.account || "-",
              status: getStatusLabel(existingStatus),
              statusCode: existingStatus,
              revenue: formatCurrency(Number(existingManual.grossRevenue)),
              manager: existingManual.manager || existingManual.em || "-",
            };

            if (existingStatus >= importStatus || existingStatus === 14 || existingStatus === 15) {
              results.manualOpportunities.skipped.push({
                opportunityId: opportunityId,
                opportunityName: oppName,
                existing: existingData,
                imported: importedData,
                decision: "skipped",
                reason:
                  existingStatus === 14
                    ? "Existing opportunity is already Booked (final state)"
                    : existingStatus === 15
                      ? "Existing opportunity is already Lost (final state)"
                      : "Existing status is more advanced",
              });
            } else {
              onManualOpportunityUpdated?.(opp);
              results.manualOpportunities.updated.push({
                opportunityId: opportunityId,
                opportunityName: oppName,
                existing: existingData,
                imported: importedData,
                decision: "updated",
                reason: "Imported status is more advanced",
              });
            }
          } else {
            if (onAddManualOpportunity) {
              onAddManualOpportunity(opp);
              results.manualOpportunities.created.push({
                opportunityId: opportunityId,
                opportunityName: oppName,
                existing: null,
                imported: importedData,
                decision: "created",
                reason: "New opportunity",
              });
            } else {
              results.manualOpportunities.skipped.push({
                opportunityId: opportunityId,
                opportunityName: oppName,
                existing: null,
                imported: importedData,
                decision: "skipped",
                reason: "Cannot create: handler not available",
              });
            }
          }
        });
      }

      // Process actions with detailed comparison
      if (importData.actionsComments) {
        const actions = (importData.actionsComments.actions || []) as (OpportunityAction & Record<string, unknown>)[];
        actions.forEach((action) => {
          try {
            const ds = useUserDataStore.getState();
            const opportunityId = action.opportunityId || "";
            let existingActions: OpportunityAction[] = [...(ds.opportunityActions[opportunityId] || [])];

            const existingIndex = existingActions.findIndex((a) => a.id === action.id);

            const importedData = {
              description: action.description || "-",
              owner: action.owner || "-",
              status: action.status || "-",
              priority: action.priority || "-",
              dueDate: formatDateShort(action.dueDate),
            };

            if (existingIndex >= 0) {
              const existingAction = existingActions[existingIndex];

              const existingData = {
                description: existingAction.description || "-",
                owner: existingAction.owner || "-",
                status: existingAction.status || "-",
                priority: existingAction.priority || "-",
                dueDate: formatDateShort(existingAction.dueDate),
              };

              const changes: string[] = [];
              if (existingAction.description !== action.description) changes.push("description");
              if (existingAction.owner !== action.owner) changes.push("owner");
              if (existingAction.status !== action.status) changes.push("status");
              if (existingAction.priority !== action.priority) changes.push("priority");
              if (existingAction.dueDate !== action.dueDate) changes.push("dueDate");

              if (changes.length > 0) {
                existingActions[existingIndex] = action;
                useUserDataStore.getState().setOpportunityActions(opportunityId, existingActions);

                results.actionsComments.actions.updated.push({
                  id: action.id,
                  opportunityId: opportunityId,
                  opportunityName: action.opportunityName || opportunityId,
                  existing: existingData,
                  imported: importedData,
                  decision: "updated",
                  reason: `Updated: ${changes.join(", ")}`,
                  changes: changes,
                });
              } else {
                results.actionsComments.actions.skipped.push({
                  id: action.id,
                  opportunityId: opportunityId,
                  opportunityName: action.opportunityName || opportunityId,
                  existing: existingData,
                  imported: importedData,
                  decision: "skipped",
                  reason: "No changes detected",
                  changes: [],
                });
              }
            } else {
              existingActions.push(action);
              useUserDataStore.getState().setOpportunityActions(opportunityId, existingActions);

              results.actionsComments.actions.created.push({
                id: action.id,
                opportunityId: opportunityId,
                opportunityName: action.opportunityName || opportunityId,
                existing: null,
                imported: importedData,
                decision: "created",
                reason: "New action",
                changes: [],
              });
            }
          } catch (e) {
            console.error("Error importing action:", e);
          }
        });
      }

      // Process manual accounts
      if (importData.manualAccounts && Array.isArray(importData.manualAccounts)) {
        const existingAccountNames = new Set<string>(manualAccounts.map((a) => a.account));

        importData.manualAccounts.forEach((acc) => {
          const accName = acc.account;
          const importedData = {
            name: accName || "-",
            parent: acc.parentAccount || "-",
            segment: acc.subSegmentCode || "-",
            subSegment: acc.subSegment || "-",
            country: acc.country || "-",
          };

          if (existingAccountNames.has(accName)) {
            results.manualAccounts.skipped.push({
              accountName: accName,
              imported: importedData,
              decision: "skipped",
              reason: "Account already exists",
            });
          } else {
            if (onAddManualAccount) {
              onAddManualAccount({
                account: acc.account,
                subSegmentCode: acc.subSegmentCode || "",
                subSegment: acc.subSegment || "",
                country: acc.country || "",
                parentAccount: acc.parentAccount || "",
              });
            }
            existingAccountNames.add(accName);
            results.manualAccounts.created.push({
              accountName: accName,
              imported: importedData,
              decision: "created",
              reason: "New account",
            });
          }
        });
      }

      setImportResult({
        success: true,
        error: null,
        details: results,
      });
      setIsImporting(false);
    },
    [
      opportunityMap,
      manualOpportunities,
      manualAccounts,
      setStatusOverride,
      onManualOpportunityUpdated,
      onAddManualOpportunity,
      onAddManualAccount,
    ]
  );

  // Handle file import
  const handleImportFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsImporting(true);
      setImportResult(null);

      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>): void => {
        try {
          const importData = JSON.parse(e.target?.result as string);
          processImport(importData);
        } catch (err) {
          setImportResult({
            success: false,
            error: "Invalid JSON file. Please select a valid export file.",
            details: null,
          });
          setIsImporting(false);
        }
      };
      reader.onerror = (): void => {
        setImportResult({
          success: false,
          error: "Failed to read file.",
          details: null,
        });
        setIsImporting(false);
      };
      reader.readAsText(file);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [processImport]
  );

  return {
    importResult,
    setImportResult,
    isImporting,
    copied,
    fileInputRef,
    handleCopyReport,
    handleDownloadReport,
    handleExportJSON,
    handleImportFile,
  };
}
