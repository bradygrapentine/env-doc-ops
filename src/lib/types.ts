export type User = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  emailVerifiedAt?: string | null;
};

export type ManualInputs = {
  growthRate?: string;
  tripGenAssumptions?: string;
  mitigationNotes?: string;
  engineerConclusions?: string;
};

export type Project = {
  id: string;
  userId: string | null;
  name: string;
  location: string;
  jurisdiction: string;
  clientName?: string;
  projectType: string;
  developmentSummary: string;
  preparedBy?: string;
  manualInputs?: ManualInputs;
  createdAt: string;
};

export type Period = "AM" | "PM" | "MIDDAY" | "OTHER";

export type TrafficCountRow = {
  id: string;
  projectId: string;
  intersection: string;
  period: Period;
  approach?: string;
  inbound: number;
  outbound: number;
  total: number;
};

export type TrafficMetrics = {
  intersections: string[];
  highestAmIntersection?: string;
  highestAmTotal?: number;
  highestPmIntersection?: string;
  highestPmTotal?: number;
  totalAmVolume: number;
  totalPmVolume: number;
};

export type SectionStatus = "draft" | "reviewed" | "final";

export type SectionKind = "standard" | "custom";

export type ReportSection = {
  id: string;
  title: string;
  order: number;
  content: string;
  status: SectionStatus;
  machineBaseline: string;
  kind: SectionKind;
};

export type Report = {
  id: string;
  projectId: string;
  sections: ReportSection[];
  createdAt: string;
  updatedAt: string;
};
