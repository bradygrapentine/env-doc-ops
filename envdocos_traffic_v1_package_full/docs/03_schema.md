# Data Schema

## Project

```ts
type Project = {
  id: string;
  name: string;
  location: string;
  jurisdiction: string;
  clientName?: string;
  projectType: string;
  developmentSummary: string;
  preparedBy?: string;
  createdAt: string;
};
```

## Traffic Count Row

```ts
type TrafficCountRow = {
  id: string;
  projectId: string;
  intersection: string;
  period: "AM" | "PM" | "MIDDAY" | "OTHER";
  approach?: string;
  inbound: number;
  outbound: number;
  total: number;
};
```

## Report

```ts
type Report = {
  id: string;
  projectId: string;
  sections: ReportSection[];
  createdAt: string;
  updatedAt: string;
};
```

## Report Section

```ts
type ReportSection = {
  id: string;
  title: string;
  order: number;
  content: string;
  status: "draft" | "reviewed" | "final";
};
```

## Derived Metrics

```ts
type TrafficMetrics = {
  intersections: string[];
  highestAmIntersection?: string;
  highestAmTotal?: number;
  highestPmIntersection?: string;
  highestPmTotal?: number;
  totalAmVolume: number;
  totalPmVolume: number;
};
```
