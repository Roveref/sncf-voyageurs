/**
 * Recruitment types — shared across RecruitmentTab, useRecruitmentData, useDataPipeline.
 */

export interface RecruitmentCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: "rejected" | "active" | "hired";
  poste: string;
  gradeBucket: string;
  jobPostings: string;
  creationDate: string;
  lastActivity: string;
  grade: string;
  candidateStatus: string;
  tags: string;
  note: number | null;
  evaluatedBy: string;
  hrInterview: string;
  linkedinUrl: string;
  recruiter1: string;
  recruiter1Date: string;
  recruiter1Decision: string;
  recruiter1EmpId: string;
  recruiter2: string;
  recruiter2Date: string;
  recruiter2Decision: string;
  recruiter2EmpId: string;
  recruiter3: string;
  recruiter3Date: string;
  recruiter3Decision: string;
  recruiter3EmpId: string;
  hrInterviewerName: string;
  hrInterviewDate: string;
  hrInterviewDecision: string;
  matchedEmpId: string;
  applications: { jobPosting: string; segment: string | null; offering: string | null }[];
}

export interface RecruitmentAggregates {
  statusCounts: { status: string; count: number }[];
  gradeBucketCounts: { gradeBucket: string; status: string; count: number }[];
  monthlyVolume: { month: string; status: string; count: number }[];
  segmentCounts: { segment: string; count: number }[];
  offeringCounts: { offering: string; count: number }[];
}
