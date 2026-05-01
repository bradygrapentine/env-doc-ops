# API Spec

## POST /api/projects
Create project.

Request:
```json
{
  "name": "West Loop Mixed Use",
  "location": "123 Main St, Chicago, IL",
  "jurisdiction": "Chicago",
  "projectType": "Mixed-use development",
  "developmentSummary": "120 residential units and 15,000 square feet of retail"
}
```

## POST /api/projects/:id/traffic-data
Upload CSV traffic count data.

Response:
```json
{
  "rowsImported": 48,
  "intersections": ["Main St & 1st Ave"]
}
```

## POST /api/projects/:id/generate-report
Generate structured draft report.

Response:
```json
{
  "reportId": "report_123",
  "sections": []
}
```

## GET /api/reports/:id
Fetch report.

## PATCH /api/reports/:id/sections/:sectionId
Update section content.

## POST /api/reports/:id/export-docx
Generate DOCX export.
