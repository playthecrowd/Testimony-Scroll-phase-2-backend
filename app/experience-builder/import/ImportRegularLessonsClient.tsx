"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/FormField";
import { generateRegularLessonCsvTemplate, parseAndValidateRegularLessonCsv, ParsedRegularLessonRow } from "@/lib/regularLessonCsv";
import { PublishedChurch } from "@/types";
import { importRegularLessonsCsvAction } from "./importActions";

function downloadTemplate() {
  const csv = generateRegularLessonCsvTemplate();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "lessons-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

// Church-scoped counterpart to CampaignLessonImportClient.tsx (platform-admin-only) -- same
// download/upload/preview/import shape, but every import targets exactly one of the signed-in
// Host's own churches (picked below, never typed/guessed), and the server action re-verifies that
// church membership itself before importing anything.
export function ImportRegularLessonsClient({ churches }: { churches: PublishedChurch[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [churchId, setChurchId] = useState(churches[0]?.id ?? "");
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<ParsedRegularLessonRow[]>([]);
  const [headerErrors, setHeaderErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importedTitles, setImportedTitles] = useState<string[] | null>(null);
  const [rowWarnings, setRowWarnings] = useState<string[]>([]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError("");
    setImportedTitles(null);
    setRowWarnings([]);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setCsvText(text);
      const result = parseAndValidateRegularLessonCsv(text);
      setRows(result.rows);
      setHeaderErrors(result.headerErrors);
    };
    reader.readAsText(file);
  }

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);
  const canImport = !!churchId && csvText && headerErrors.length === 0 && rows.length > 0 && invalidRows.length === 0 && !importing;

  async function handleImport() {
    setImporting(true);
    setImportError("");
    const result = await importRegularLessonsCsvAction(csvText, churchId);
    setImporting(false);
    if (result.error) {
      setImportError(result.error);
      return;
    }
    if (result.rowErrors) {
      // Server-side re-validation found something the client-side preview missed -- surface it the
      // same way, never import silently.
      setRows((prev) =>
        prev.map((r) => {
          const serverError = result.rowErrors!.find((e) => e.rowNumber === r.rowNumber);
          return serverError ? { ...r, errors: serverError.errors } : r;
        })
      );
      setImportError("The server found additional issues -- see the row errors below. Nothing was imported.");
      return;
    }
    setImportedTitles(result.importedTitles ?? []);
    setRowWarnings(result.rowWarnings ?? []);
    setCsvText("");
    setRows([]);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  if (churches.length === 0) {
    return (
      <div className="qk-card p-5">
        <p className="text-sm text-foreground font-medium">Complete your church setup before bulk-uploading lessons.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {churches.length > 1 && (
        <div className="qk-card p-5">
          <Field label="Import into" required>
            <select value={churchId} onChange={(e) => setChurchId(e.target.value)} className="qk-input">
              {churches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      <div className="qk-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">1. Download the template</h2>
        <p className="text-xs text-muted mb-3">
          Every column this importer expects, with one filled-in example row. Need Excel? Open the template in Excel, fill it out,
          then save/export as CSV before uploading here.
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={downloadTemplate}>
          <Download size={14} /> Download CSV Template
        </Button>
      </div>

      <div className="qk-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">2. Upload your CSV</h2>
        <p className="text-xs text-muted mb-3">Every row is validated before anything is imported -- fix any errors shown below and re-upload.</p>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileSelect} className="text-xs text-muted" />
        {fileName && <p className="text-[11px] text-muted mt-2">Selected: {fileName}</p>}
      </div>

      {headerErrors.length > 0 && (
        <div className="qk-card p-5 border-red-500/30">
          <p className="text-sm font-semibold text-red-300 mb-2 flex items-center gap-1.5">
            <XCircle size={15} /> This file doesn&apos;t match the expected template
          </p>
          <ul className="text-xs text-red-300 space-y-1 list-disc list-inside">
            {headerErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 && headerErrors.length === 0 && (
        <div className="qk-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">3. Review before importing</h2>
          <p className="text-xs text-muted mb-3">
            {validRows.length} of {rows.length} row{rows.length === 1 ? "" : "s"} ready to import.
            {invalidRows.length > 0 && ` ${invalidRows.length} row${invalidRows.length === 1 ? " has" : "s have"} errors -- nothing imports until every row is valid.`}
          </p>
          <div className="space-y-2 max-h-96 overflow-y-auto qk-scrollbar">
            {rows.map((row) => (
              <div key={row.rowNumber} className={`p-3 rounded-lg border text-xs ${row.errors.length > 0 ? "border-red-500/30 bg-red-500/5" : "border-border-subtle"}`}>
                <div className="flex items-center gap-2 mb-1">
                  {row.errors.length > 0 ? (
                    <AlertTriangle size={13} className="text-red-300 shrink-0" />
                  ) : (
                    <CheckCircle2 size={13} className="text-accent-blue-light shrink-0" />
                  )}
                  <span className="font-medium text-foreground">Row {row.rowNumber}</span>
                  <span className="text-muted truncate">{row.raw.lesson_title || "(no title)"}</span>
                </div>
                {row.errors.length > 0 && (
                  <ul className="text-red-300 list-disc list-inside ml-5 space-y-0.5">
                    {row.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {importError && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-4">{importError}</p>}

          <Button type="button" disabled={!canImport} onClick={handleImport} className="mt-4">
            <Upload size={16} /> {importing ? "Importing..." : `Confirm Import (${validRows.length} lesson${validRows.length === 1 ? "" : "s"})`}
          </Button>
        </div>
      )}

      {importedTitles && (
        <div className="qk-card p-5 border-accent-blue-light/30">
          <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-accent-blue-light" /> Imported {importedTitles.length} lesson{importedTitles.length === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-muted">
            Rows without <span className="text-foreground">Published = true</span> were imported as drafts -- publish them from{" "}
            <a href="/experience-builder" className="text-accent-blue-light hover:underline">
              Your Lessons
            </a>
            .
          </p>
          {rowWarnings.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border-subtle">
              <p className="text-xs font-semibold text-amber-300 mb-1.5 flex items-center gap-1.5">
                <AlertTriangle size={13} /> Some rows had issues
              </p>
              <ul className="text-xs text-amber-300 list-disc list-inside space-y-0.5">
                {rowWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
