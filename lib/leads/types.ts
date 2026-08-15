/**
 * Lead DTOs shared across server and client. Dates are serialized as ISO
 * strings at the JSON boundary, so all timestamps below are `string`.
 */

export interface LeadOwner {
  id: string;
  fullName: string;
}

export interface LeadListItem {
  id: string;
  leadNumber: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  industry: string | null;
  geography: string | null;
  source: string;
  status: string;
  ownerId: string | null;
  ownerName: string | null;
  budget: number | null;
  expectedClosingDate: string | null;
  interestedProduct: string | null;
  aiScore: number | null;
  aiScoreCategory: string | null;
  aiScoreConfidence: number | null;
  qualificationStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadStatusHistoryItem {
  id: string;
  leadId: string;
  fromStatus: string | null;
  toStatus: string;
  changedAt: string;
  notes: string | null;
  changedByName: string | null;
}

export interface LeadDetail extends LeadListItem {
  alternatePhone: string | null;
  companySize: string | null;
  website: string | null;
  notes: string | null;
  qualificationMetadata: unknown;
  statusHistory: LeadStatusHistoryItem[];
}

export interface LeadListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface QualificationAssessment {
  id: string;
  leadId: string;
  requirementClarity: string;
  budgetAvailability: string;
  purchaseTimeline: string;
  decisionMaker: string;
  companyScale: string;
  productFit: string;
  conversionProbability: string;
  decisionMakerName: string | null;
  decisionMakerDesignation: string | null;
  result: string;
  reason: string | null;
  notes: string | null;
  qualifiedAt: string;
  qualifiedByName: string | null;
}

export interface LeadQualificationState {
  outcome: string;
  latest: QualificationAssessment | null;
  history: QualificationAssessment[];
}
