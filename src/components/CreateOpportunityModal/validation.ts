/**
 * Validation logic and utilities for CreateOpportunityModal
 */

import { alpha, Theme } from "@mui/material/styles";

export const validateOpportunityForm = (
  formData: Record<string, any>,
  isBooked: boolean,
  totalAllocation: number
): Record<string, string> => {
  const newErrors: Record<string, string> = {};

  if (!formData.opportunity?.trim()) {
    newErrors.opportunity = "Required";
  }
  if (!formData.account?.trim()) {
    newErrors.account = "Required";
  }
  if (!formData.status) {
    newErrors.status = "Required";
  }
  if (!formData.grossRevenue && String(formData.grossRevenue) !== "0") {
    newErrors.grossRevenue = "Required";
  }
  if (!formData.netRevenue && String(formData.netRevenue) !== "0") {
    newErrors.netRevenue = "Required";
  }
  if (!formData.serviceLine1?.trim()) {
    newErrors.serviceLine1 = "Requis";
  }

  if (isBooked && !formData.estimatedBookingDate) {
    newErrors.estimatedBookingDate = "Requis pour le statut En exploitation";
  }

  const hasAllocations = formData.allocation1 || formData.allocation2 || formData.allocation3;
  if (hasAllocations && totalAllocation !== 100) {
    newErrors.allocation = "Le total d'allocation doit être de 100%";
  }

  return newErrors;
};

export const formatNumberWithSpaces = (value: any): string => {
  if (!value && value !== 0) return "";
  const numValue = typeof value === "string" ? parseFloat(value.replace(/\s/g, "")) : value;
  if (isNaN(numValue)) return "";
  return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

export const parseNumberFromFormatted = (formattedValue: string): string => {
  if (!formattedValue) return "";
  return formattedValue.replace(/\s/g, "");
};

export const generateOpportunityId = (): string => {
  const random = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
  return `M-${random}`;
};

export const STATUS_OPTIONS = [
  { value: 1, label: "Émergence" },
  { value: 4, label: "Investissement / CEB" },
  { value: 6, label: "Étude en cours" },
  { value: 11, label: "Maintenance lourde" },
  { value: 13, label: "Conventionné" },
  { value: 14, label: "En exploitation" },
  { value: 15, label: "Déclassé" },
];

export const getStatusColor = (status: number, theme: Theme) => {
  switch (status) {
    case 1:
    case 4:
      return {
        bgcolor: alpha(theme.palette.primary.light, 0.15),
        color: theme.palette.primary.light,
        borderColor: alpha(theme.palette.primary.light, 0.3),
        headerBg: theme.palette.primary.light,
      };
    case 6:
      return {
        bgcolor: alpha(theme.palette.primary.main, 0.15),
        color: theme.palette.primary.main,
        borderColor: alpha(theme.palette.primary.main, 0.3),
        headerBg: theme.palette.primary.main,
      };
    case 11:
    case 13:
      return {
        bgcolor: alpha(theme.palette.primary.dark, 0.15),
        color: theme.palette.primary.dark,
        borderColor: alpha(theme.palette.primary.dark, 0.3),
        headerBg: theme.palette.primary.dark,
      };
    case 14:
      return {
        bgcolor: alpha(theme.palette.success.main, 0.15),
        color: theme.palette.success.main,
        borderColor: alpha(theme.palette.success.main, 0.3),
        headerBg: theme.palette.success.main,
      };
    case 15:
      return {
        bgcolor: alpha(theme.palette.error.main, 0.15),
        color: theme.palette.error.main,
        borderColor: alpha(theme.palette.error.main, 0.3),
        headerBg: theme.palette.error.main,
      };
    default:
      return {
        bgcolor: alpha(theme.palette.grey[500], 0.15),
        color: theme.palette.grey[700],
        borderColor: alpha(theme.palette.grey[500], 0.3),
        headerBg: theme.palette.grey[500],
      };
  }
};
