import type { OverrideData } from "../stores/useUserDataStore";

export interface Opportunity {
  opportunityId: string;
  opportunity: string;
  accountId?: string;
  account: string;
  status: number;
  grossRevenue?: number;
  netRevenue?: number;
  isAllocated?: boolean;
  allocatedGrossRevenue?: number;
  allocatedNetRevenue?: number;
  allocatedServiceLine?: string;
  allocatedOffering?: string;
  allocationPercentage?: number;
  allocation1?: number;
  allocation2?: number;
  allocation3?: number;
  serviceLine1?: string;
  serviceLine2?: string;
  serviceLine3?: string;
  serviceOffering1?: string;
  serviceOffering2?: string;
  serviceOffering3?: string;
  serviceOffering1Pct?: number;
  serviceOffering2Pct?: number;
  serviceOffering3Pct?: number;
  subSegmentCode?: string;
  subSegment?: string;
  engagementType?: string;
  creationDate?: string;
  bookingDate?: string;
  estimatedBookingDate?: string;
  lastStatusChangeDate?: string;
  lostComment?: string;
  winPct?: number;
  cm1Pct?: string | number;
  jobCode?: string;
  weightedBooking?: number;
  techPartner1?: string;
  techPartner2?: string;
  techPartner3?: string;
  partner?: string;
  manager?: string;
  em?: string;
  ep?: string;
  managerId?: string;
  partnerId?: string;
  emId?: string;
  epId?: string;
  country?: string;
  region?: string;
  primaryContactId?: string;
  primaryContact?: string;
  // Internal fields added by the app
  _originalStatus?: number;
  _originalBookingDate?: string;
  _statusOverride?: OverrideData;
  isManual?: boolean;
  // Allow additional dynamic fields
  [key: string]: unknown;
}

export interface CrmContact {
  contactId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile: string;
  jobTitle: string;
  department: string;
  city: string;
  country: string;
  accountId: string;
  account: string;
  owner: string;
  createdOn: string;
}

export interface CrmAccount {
  accountId?: string;
  account: string;
  subSegmentCode?: string;
  subSegment?: string;
  country?: string;
  region?: string;
  parentAccount?: string;
  accountLeader?: string;
  isManual?: boolean;
  createdAt?: string;
  [key: string]: unknown;
}
