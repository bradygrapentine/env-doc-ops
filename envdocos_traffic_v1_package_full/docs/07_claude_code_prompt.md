# Claude Code Build Prompt

You are building EnvDocOS Traffic V1.

## Goal
Create a working Next.js application that generates a traffic impact report draft from project metadata and uploaded traffic count CSV data.

## Product Constraints
This app is NOT traffic modeling software. Do not build traffic prediction, simulation, camera analytics, or ML. It is a report compiler. It takes existing data and produces editable report sections and DOCX export.

## Required Features
1. Create project form
2. Traffic CSV upload and validation
3. Traffic metrics calculation
4. Template-based report generation
5. Editable report sections
6. DOCX export

## Tech Stack
- Next.js
- TypeScript
- TailwindCSS
- PapaParse for CSV parsing
- docx npm package for DOCX export
- In-memory storage or SQLite for V1

## Required Pages
- `/` project list
- `/projects/new` create project
- `/projects/[id]` project dashboard/upload
- `/reports/[id]` report editor/export

## Required Types
Use the schema from `docs/03_schema.md`.

## Required Output
A runnable app with sample data and a README explaining how to start it.

## Acceptance Criteria
- User can create project
- User can upload sample CSV
- User can generate report
- User can edit sections
- User can download DOCX
