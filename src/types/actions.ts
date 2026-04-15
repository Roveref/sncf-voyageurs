export interface OpportunityAction {
  id: string;
  description: string;
  owner: string;
  dueDate: string;
  priority: "low" | "medium" | "high" | string;
  status: "open" | "done";
  createdAt?: string;
  opportunityId?: string;
  opportunityName?: string;
}

export interface RevenueTeamMember {
  id: string;
  name: string;
  gradeBucket: "M/SM" | "Director" | "Partner";
  percentage: number; // 0-100, share within the grade bucket
  opportunityId?: string;
}

export interface StaffingNeedItem {
  id: string;
  grade: string;
  startDate: string;
  endDate: string;
  utilization: number;
  quantity?: number;
  skills?: string[];
  probability?: number;
  description?: string;
  status?: "open" | "partiallyFilled" | "filled" | "cancelled" | string;
  assignedTo?: string;
  opportunityId?: string;
  createdAt?: string;
  /** Staffing assignments for this need */
  assignments?: StaffingAssignment[];
}

export interface StaffingAssignment {
  id: string;
  needId: string;
  empId: string;
  empName: string;
  startDate: string;
  endDate: string;
  utilization: number;
  status: "proposed" | "confirmed" | "cancelled";
  score?: number;
  scoreBreakdown?: Record<string, number>;
  source: "manual" | "optimizer" | "ai";
  scenarioId: string | null;
  createdAt: string;
  confirmedAt?: string;
}
