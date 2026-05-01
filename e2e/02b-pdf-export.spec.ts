import { test, expect } from "./fixtures";
import { createUserAndSignIn } from "./fixtures";
import { createProject, uploadAndImportCsv, generateReport } from "./helpers";
import fs from "node:fs/promises";

test("DOCX and PDF exports return valid magic bytes", async ({ page }) => {
  await createUserAndSignIn(page, "exports");
  await createProject(page, { name: "Exports Test" });
  await uploadAndImportCsv(page);
  await generateReport(page);

  const [docx] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export DOCX/ }).click(),
  ]);
  const docxPath = await docx.path();
  expect(docxPath).toBeTruthy();
  const docxBuf = await fs.readFile(docxPath!);
  expect(docxBuf.slice(0, 2).toString("utf8")).toBe("PK");

  const [pdf] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export PDF/ }).click(),
  ]);
  const pdfPath = await pdf.path();
  expect(pdfPath).toBeTruthy();
  const pdfBuf = await fs.readFile(pdfPath!);
  expect(pdfBuf.slice(0, 4).toString("utf8")).toBe("%PDF");
});
