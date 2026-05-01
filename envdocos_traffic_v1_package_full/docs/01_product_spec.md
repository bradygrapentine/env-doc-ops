# Traffic Impact Report Generator V1 Spec

## Core Wedge
Use existing traffic count data and project metadata to generate 60-80% of a traffic impact report draft.

## Target User
Small to mid-sized civil/traffic engineering firms, land development consultants, or internal engineering teams that already collect traffic counts and manually write reports.

## Primary Pain
Engineers and junior staff spend hours:
- Copying project descriptions
- Formatting traffic tables
- Writing repetitive report sections
- Turning count data into narrative text
- Assembling Word documents
- Maintaining consistency across reports

## Core Value
The product does not replace traffic engineering analysis. It replaces the repetitive document assembly layer.

## V1 Inputs

### Project Metadata
- Project name
- Location
- Jurisdiction
- Client
- Project type
- Land use assumptions
- Development size
- Prepared by
- Date

### Traffic CSV
Minimum V1 schema:

```csv
intersection,period,approach,inbound,outbound,total
Main St & 1st Ave,AM,Northbound,120,90,210
Main St & 1st Ave,PM,Northbound,160,110,270
```

### Optional Manual Inputs
- Background growth rate
- Trip generation assumptions
- Mitigation notes
- Engineer conclusions
- Study area notes
- Jurisdictional requirements

## V1 Outputs
- Structured report JSON
- Editable report sections
- DOCX export
- Optional PDF export later

## Success Criteria
A domain expert says:
- “This gets me 50-70% of the way there.”
- “I would use this for a first draft.”
- “This saves junior staff time.”
- “This is useful even if I still have to review and stamp it.”
