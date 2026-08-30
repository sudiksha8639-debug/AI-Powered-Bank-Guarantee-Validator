import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { PdfViewer } from "@/components/PdfViewer";
import { extractDocumentText, isPdfFile, getAcceptedExtensions, getFileTypeLabel } from "@/lib/document-processor";
import { generateReport } from "@/lib/pdf-report";
import { extractClauses } from "@/lib/template-analyzer";
import { validateBg, computeResult } from "@/lib/validator";
import type {
  ProcessingStage,
  ValidationFinding,
  FindingStatus,
  FindingCategory,
} from "@/lib/types";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import {
  Shield,
  Upload,
  FileText,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  ArrowRight,
  X,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Info,
  MapPin,
  Type,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
} from "lucide-react";
import { format } from "date-fns";

const STAGE_MESSAGES: Record<ProcessingStage, string> = {
  uploading: "Uploading document…",
  detecting: "Detecting document type…",
  extracting: "Extracting text…",
  enhancing: "Enhancing low-resolution pages…",
  ocr: "Running OCR on scanned pages…",
  validating: "Validating clauses and consistency…",
  report: "Generating report…",
  complete: "Validation complete.",
};

const STAGE_ORDER: ProcessingStage[] = [
  "uploading",
  "detecting",
  "extracting",
  "enhancing",
  "ocr",
  "validating",
  "report",
  "complete",
];

const statusStyles: Record<FindingStatus, { icon: any; className: string; label: string }> = {
  PASS: {
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    label: "PASS",
  },
  REVIEW: {
    icon: AlertTriangle,
    className: "bg-amber-50 text-amber-700 border-amber-200",
    label: "REVIEW",
  },
  FAIL: {
    icon: XCircle,
    className: "bg-red-50 text-red-700 border-red-200",
    label: "FAIL",
  },
  INFO: {
    icon: Info,
    className: "bg-blue-50 text-blue-700 border-blue-200",
    label: "INFO",
  },
};

const categoryOrder: FindingCategory[] = [
  "Clause Validation",
  "Consistency Validation",
  "Logical Validation",
  "Document Validation",
  "Optional Information",
];

const statusOrder: FindingStatus[] = ["PASS", "REVIEW", "FAIL", "INFO"];

export default function Workspace() {
  const navigate = useNavigate();
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const templates = useQuery(api.templates.list);
  const createTemplate = useMutation(api.templates.create);
  const createValidation = useMutation(api.validations.create);

  const [step, setStep] = useState<string>("template");
  const [selectedTemplateId, setSelectedTemplateId] = useState<any>(null);
  const [selectedTemplateName, setSelectedTemplateName] = useState("");
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [stage, setStage] = useState<ProcessingStage>("uploading");
  const [stageMessage, setStageMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [resultData, setResultData] = useState<{
    findings: ValidationFinding[];
    documentType: string;
    pageCount: number;
    status: string;
    passCount: number;
    reviewCount: number;
    failCount: number;
    infoCount: number;
    extractedText: string;
  } | null>(null);
  const [validationId, setValidationId] = useState<string | null>(null);

  const [pdfPage, setPdfPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(1);

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedFinding, setSelectedFinding] = useState<ValidationFinding | null>(null);
  const [userInstructions, setUserInstructions] = useState("");

  const filteredFindings = resultData?.findings.filter((f) => {
    if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    return true;
  });

  const groupedFindings = categoryOrder
    .map((cat) => ({
      category: cat,
      items: filteredFindings?.filter((f) => f.category === cat) ?? [],
    }))
    .filter((g) => g.items.length > 0);

  const statusCounts = resultData
    ? {
        PASS: resultData.findings.filter((f) => f.status === "PASS").length,
        REVIEW: resultData.findings.filter((f) => f.status === "REVIEW").length,
        FAIL: resultData.findings.filter((f) => f.status === "FAIL").length,
        INFO: resultData.findings.filter((f) => f.status === "INFO").length,
      }
    : null;

  const handleFindingClick = useCallback((finding: ValidationFinding) => {
    setSelectedFinding(finding);
    if (finding.pageNumber) {
      setPdfPage(finding.pageNumber);
    }
  }, []);

  const handleTemplateUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);
      setStageMessage("Extracting template clauses…");
      setStage("extracting");

      try {
        const { pages } = await extractDocumentText(file);
        const fullText = pages.map((p) => p.text).join("\n\n");
        const clauses = extractClauses(fullText);

        const id = await createTemplate({
          filename: file.name,
          extractedText: fullText,
          clauses,
        });

        setSelectedTemplateId(id);
        setSelectedTemplateName(file.name);
        setStep("upload");
      } catch (err) {
        console.error("Template upload error:", err);
        setError("Could not process the template. Please upload a valid document.");
        setStep("template");
      }
    },
    [createTemplate]
  );

  const handleSelectTemplate = (id: any, filename: string) => {
    setSelectedTemplateId(id);
    setSelectedTemplateName(filename);
    setStep("upload");
  };

  const handleBgUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !selectedTemplateId) return;

      setError(null);
      setBgFile(file);
      setStep("processing");

      try {
        setStage("uploading");
        setStageMessage(STAGE_MESSAGES.uploading);

        setStage("detecting");
        setStageMessage(STAGE_MESSAGES.detecting);
        await new Promise((r) => setTimeout(r, 300));

        setStage("extracting");
        setStageMessage(STAGE_MESSAGES.extracting);

        const { pages, documentType } = await extractDocumentText(file, (msg) => {
          setStageMessage(msg);
        });
        const fullText = pages.map((p) => p.text).join("\n\n");

        setStage("validating");
        setStageMessage(STAGE_MESSAGES.validating);

        const templateData = templates?.find(
          (t) => String(t._id) === String(selectedTemplateId)
        );
        const templateText = templateData?.extractedText ?? "";
        const templateClauses = templateData?.clauses ?? [];

        const findings = validateBg(templateClauses, templateText, fullText, pages, userInstructions || undefined);
        const result = computeResult(findings, documentType, pages.length, fullText);

        setStage("report");
        setStageMessage(STAGE_MESSAGES.report);

        const id = await createValidation({
          templateId: selectedTemplateId,
          filename: file.name,
          documentType: result.documentType,
          pageCount: result.pageCount,
          status: result.status,
          passCount: result.passCount,
          reviewCount: result.reviewCount,
          failCount: result.failCount,
          infoCount: result.infoCount,
          extractedText: fullText,
          userInstructions: userInstructions || undefined,
          findings: findings.map((f) => ({
            category: f.category,
            checkId: f.checkId,
            label: f.label,
            status: f.status,
            detail: f.detail,
            pageNumber: f.pageNumber,
            extractedText: f.extractedText,
          })),
        });

        setValidationId(id);
        setResultData({ ...result, findings });
        setStage("complete");
        setStageMessage(STAGE_MESSAGES.complete);

        await new Promise((r) => setTimeout(r, 600));
        setStep("results");
      } catch (err) {
        console.error("Validation error:", err);
        setError("Unable to process this document. Upload a valid Bank Guarantee in PDF, Word, text, or image format.");
        setStep("upload");
        setStage("uploading");
      }
    },
    [selectedTemplateId, templates, createValidation]
  );

  const handleDownloadReport = () => {
    if (!resultData || !bgFile) return;
    generateReport(
      {
        status: resultData.status,
        documentType: resultData.documentType,
        pageCount: resultData.pageCount,
        passCount: resultData.passCount,
        reviewCount: resultData.reviewCount,
        failCount: resultData.failCount,
        infoCount: resultData.infoCount,
        findings: resultData.findings.map((f) => ({
          id: f.id,
          category: f.category,
          checkId: f.checkId,
          label: f.label,
          status: f.status,
          detail: f.detail,
          pageNumber: f.pageNumber,
          extractedText: f.extractedText,
        })),
      },
      bgFile.name,
      selectedTemplateName,
      format(new Date(), "PPP"),
      userInstructions || undefined,
    );
  };

  const overallStatusConfig: Record<string, { className: string; label: string }> = {
    VALID: { className: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "VALID" },
    REVIEW: { className: "bg-amber-50 text-amber-700 border-amber-200", label: "REVIEW REQUIRED" },
    DISCREPANT: { className: "bg-red-50 text-red-700 border-red-200", label: "DISCREPANT" },
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-sm shadow-primary/20">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold tracking-tight">
              BG Validator Pro
            </span>
          </div>
          <div className="flex items-center gap-2">
            {step === "results" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadReport}
                className="gap-1.5 rounded-lg"
              >
                <Download className="h-3.5 w-3.5" />
                Report
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="gap-1.5 text-muted-foreground rounded-lg"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-[1600px] px-6 py-6">
        {/* Steps indicator */}
        {step !== "results" && (
          <div className="mb-8 flex items-center gap-0">
            {[
              { key: "template", label: "Reference Template", num: "1" },
              { key: "upload", label: "Submit Bank Guarantee", num: "2" },
              { key: "processing", label: "Processing", num: "3" },
            ].map((s, i, arr) => {
              const isDone = (step === "upload" && s.key === "template") || (step === "processing" && (s.key === "template" || s.key === "upload"));
              const isCurrent = step === s.key || (step === "processing" && s.key === "processing");
              return (
                <div key={s.key} className="flex items-center">
                  <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${isCurrent ? "bg-primary/[0.06]" : ""}`}>
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                      isDone ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : isCurrent ? "bg-primary/15 text-primary ring-2 ring-primary/20" : "bg-muted/50 text-muted-foreground border border-border/50"
                    }`}>
                      {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.num}
                    </div>
                    <span className={`text-xs font-medium transition-colors hidden sm:inline ${isCurrent ? "text-foreground" : isDone ? "text-foreground/70" : "text-muted-foreground/50"}`}>{s.label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`w-8 h-px mx-1 transition-colors ${isDone ? "bg-primary/30" : "bg-border/50"}`} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-5 py-3.5 text-sm text-destructive shadow-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100 transition-opacity">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Step 1: Template */}
        {step === "template" && (
          <div className="space-y-6">
            {/* Template card */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border/40 bg-muted/20 px-7 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Reference Template</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Upload the standard BG template your team uses as the validation baseline.</p>
                  </div>
                </div>
              </div>

              <div className="px-7 py-6">
                {/* Previous templates */}
                {templates && templates.length > 0 && (
                  <div className="mb-6">
                    <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">Previously Loaded</p>
                    <div className="grid gap-2">
                      {templates.map((t) => (
                        <button
                          key={t._id}
                          onClick={() => handleSelectTemplate(t._id, t.filename)}
                          className="flex items-center gap-3.5 rounded-xl border border-border/50 bg-background px-4 py-3.5 text-left text-sm transition-all hover:border-primary/30 hover:bg-primary/[0.02] hover:shadow-md group"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground group-hover:bg-primary/[0.08] group-hover:text-primary transition-colors">
                            <FileText className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-foreground">{t.filename}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t.clauses.length} clauses extracted</p>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground/40 group-hover:text-primary transition-colors">
                            Use
                            <ArrowRight className="h-3.5 w-3.5" />
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50" /></div>
                      <div className="relative flex justify-center"><span className="bg-card px-4 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Or upload a new one</span></div>
                    </div>
                  </div>
                )}

                {/* Upload area */}
                <label className="group relative flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border/60 bg-gradient-to-b from-muted/10 to-muted/30 px-8 py-16 text-center transition-all hover:border-primary/40 hover:from-primary/[0.02] hover:to-primary/[0.04]">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground group-hover:bg-primary/[0.1] group-hover:text-primary transition-all duration-300 group-hover:scale-105">
                    <Upload className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Click to upload a reference template</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">PDF, Word (.docx), text, or image files</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {['PDF', 'DOCX', 'TXT', 'PNG', 'JPG'].map((ext) => (
                      <span key={ext} className="rounded-md bg-muted/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">.{ext.toLowerCase()}</span>
                    ))}
                  </div>
                  <input type="file" accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg" className="hidden" onChange={handleTemplateUpload} />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Upload BG */}
        {step === "upload" && (
          <div className="space-y-6">
            {/* Active template indicator */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Template Loaded</p>
                    <p className="text-sm font-medium text-emerald-800">{selectedTemplateName}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStep("template")} className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100 gap-1.5 rounded-lg text-xs">
                  <ArrowLeft className="h-3 w-3" />Change
                </Button>
              </div>
            </div>

            {/* User Instructions */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border/40 bg-muted/20 px-7 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Additional Validation Instructions</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Optionally provide extra requirements or context to supplement the automated checks.</p>
                  </div>
                </div>
              </div>
              <div className="px-7 py-5">
                <textarea
                  value={userInstructions}
                  onChange={(e) => setUserInstructions(e.target.value)}
                  placeholder="e.g. Ensure the BG amount matches the contract value. Verify the issuing bank is an approved institution. Check that the beneficiary name matches the project partner."
                  className="w-full rounded-xl border border-border/60 bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none"
                  rows={3}
                />
                <p className="mt-2 text-[11px] text-muted-foreground/60">Separate multiple instructions with semicolons. These instructions will appear in the validation report but do not override the core validation engine.</p>
              </div>
            </div>

            {/* Upload card */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border/40 bg-muted/20 px-7 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Upload className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Submit a Bank Guarantee</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Upload the BG document to validate against the loaded template.</p>
                  </div>
                </div>
              </div>

              <div className="px-7 py-6">
                <label className="group relative flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border/60 bg-gradient-to-b from-muted/10 to-muted/30 px-8 py-16 text-center transition-all hover:border-primary/40 hover:from-primary/[0.02] hover:to-primary/[0.04]">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground group-hover:bg-primary/[0.1] group-hover:text-primary transition-all duration-300 group-hover:scale-105">
                    <Upload className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Click to upload a Bank Guarantee</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">PDF, Word (.docx), scanned images, or text files</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {['PDF', 'DOCX', 'PNG', 'JPG'].map((ext) => (
                      <span key={ext} className="rounded-md bg-muted/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">.{ext.toLowerCase()}</span>
                    ))}
                  </div>
                  <input ref={bgFileInputRef} type="file" accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg" className="hidden" onChange={handleBgUpload} />
                </label>
              </div>
            </div>
          </div>
        )}        {/* Processing */}
        {step === "processing" && (
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="border-b border-border/40 bg-muted/20 px-7 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Processing Document</h2>
                  <p className="text-xs text-muted-foreground mt-0.5 font-medium">{bgFile?.name}</p>
                </div>
              </div>
            </div>

            <div className="px-7 py-6">
              <div className="space-y-1.5">
                {STAGE_ORDER.filter((s) => s !== "complete").map((s, i) => {
                  const currentIdx = STAGE_ORDER.indexOf(stage);
                  const thisIdx = STAGE_ORDER.indexOf(s);
                  const isComplete = thisIdx < currentIdx;
                  const isCurrent = thisIdx === currentIdx;

                  return (
                    <div
                      key={s}
                      className={`flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm transition-all duration-300 ${
                        isCurrent
                          ? "bg-primary/[0.06] border border-primary/20 shadow-sm"
                          : isComplete
                            ? "text-foreground/70"
                            : "text-muted-foreground/30"
                      }`}
                    >
                      {isComplete ? (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                      ) : isCurrent ? (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                        </div>
                      ) : (
                        <div className="h-6 w-6 shrink-0 rounded-full border-2 border-border/40" />
                      )}
                      <span className="flex-1 font-medium">{isCurrent ? stageMessage : STAGE_MESSAGES[s]}</span>
                      {isComplete && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Done</span>
                      )}
                      {isCurrent && (
                        <div className="h-1.5 w-16 rounded-full bg-primary/10 overflow-hidden">
                          <div className="h-full rounded-full bg-primary animate-pulse" style={{ width: `${Math.min(95, 20 + i * 15)}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Results: Split View */}
        {step === "results" && resultData && bgFile && (
          <>
            {/* Results Header */}
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold tracking-tight">{bgFile.name}</h1>
                  <Badge
                    variant="outline"
                    className={`${overallStatusConfig[resultData.status]?.className} font-semibold rounded-md px-2.5 py-0.5`}
                  >
                    {overallStatusConfig[resultData.status]?.label}
                  </Badge>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {resultData.documentType} · {resultData.pageCount} page{resultData.pageCount !== 1 ? "s" : ""}
                  {validationId && " · Saved to history"}
                </p>
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-semibold text-emerald-700">{resultData.passCount}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  <span className="font-semibold text-amber-700">{resultData.reviewCount}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm">
                  <XCircle className="h-3.5 w-3.5 text-red-600" />
                  <span className="font-semibold text-red-700">{resultData.failCount}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm">
                  <Info className="h-3.5 w-3.5 text-blue-600" />
                  <span className="font-semibold text-blue-700">{resultData.infoCount}</span>
                </div>
              </div>
            </div>

            {/* Split View */}
            <ResizablePanelGroup direction="horizontal" className="rounded-xl border border-border/60 bg-card shadow-sm min-h-[600px]">
              {/* Left: PDF Viewer */}
              <ResizablePanel defaultSize={50} minSize={35}>
                <div className="flex h-full flex-col border-r border-border/60">
                  <div className="flex items-center justify-between border-b border-border/40 bg-muted/30 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Document</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg"
                        onClick={() => setPdfPage(Math.max(1, pdfPage - 1))}
                        disabled={pdfPage <= 1}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <span className="min-w-[60px] text-center text-xs font-medium text-muted-foreground">
                        {pdfPage} / {resultData.pageCount}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg"
                        onClick={() => setPdfPage(Math.min(resultData.pageCount, pdfPage + 1))}
                        disabled={pdfPage >= resultData.pageCount}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                      <div className="h-4 w-px bg-border/60 mx-1" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg"
                        onClick={() => setPdfScale(Math.max(0.5, pdfScale - 0.25))}
                      >
                        <ZoomOut className="h-3.5 w-3.5" />
                      </Button>
                      <span className="min-w-[40px] text-center text-xs font-medium text-muted-foreground">
                        {Math.round(pdfScale * 100)}%
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg"
                        onClick={() => setPdfScale(Math.min(2, pdfScale + 0.25))}
                      >
                        <ZoomIn className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg"
                        onClick={() => setPdfScale(1)}
                      >
                        <Maximize className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="flex-1">
                    <PdfViewer file={bgFile} pageNumber={pdfPage} scale={pdfScale} />
                  </ScrollArea>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Right: Findings */}
              <ResizablePanel defaultSize={50} minSize={30}>
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b border-border/40 bg-muted/30 px-4 py-2.5">
                    <span className="text-sm font-semibold">
                      Findings
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        ({filteredFindings?.length ?? 0})
                      </span>
                    </span>
                  </div>

                  {/* Status filter tabs */}
                  {statusCounts && (
                    <div className="flex items-center gap-1 border-b border-border/40 px-4 py-2 overflow-x-auto">
                      <button
                        onClick={() => setStatusFilter("all")}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          statusFilter === "all"
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                      >
                        All
                        <span className="opacity-60">({resultData.findings.length})</span>
                      </button>
                      {statusOrder.map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatusFilter(s)}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            statusFilter === s
                              ? `${statusStyles[s].className} border`
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          }`}
                        >
                          {s === "PASS" && <CheckCircle2 className="h-3 w-3" />}
                          {s === "REVIEW" && <AlertTriangle className="h-3 w-3" />}
                          {s === "FAIL" && <XCircle className="h-3 w-3" />}
                          {s === "INFO" && <Info className="h-3 w-3" />}
                          {s}
                          <span className="opacity-60">({statusCounts[s]})</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Category filter */}
                  <div className="flex items-center gap-1 border-b border-border/40 px-4 py-2 overflow-x-auto">
                    <Button
                      variant={categoryFilter === "all" ? "default" : "ghost"}
                      size="sm"
                      className="h-7 text-xs rounded-lg px-3 shrink-0"
                      onClick={() => setCategoryFilter("all")}
                    >
                      All Categories
                    </Button>
                    {categoryOrder.map((cat) => {
                      const count = resultData.findings.filter((f) => f.category === cat).length;
                      if (count === 0) return null;
                      return (
                        <Button
                          key={cat}
                          variant={categoryFilter === cat ? "default" : "ghost"}
                          size="sm"
                          className="h-7 text-xs rounded-lg px-3 shrink-0"
                          onClick={() => setCategoryFilter(cat)}
                        >
                          {cat.replace(" Validation", "")} ({count})
                        </Button>
                      );
                    })}
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-5">
                      {groupedFindings.length === 0 ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                          No findings match the current filters.
                        </div>
                      ) : (
                        groupedFindings.map((group) => (
                          <div key={group.category}>
                            <h3 className="mb-2.5 text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">
                              {group.category}
                            </h3>
                            <div className="space-y-2">
                              {group.items.map((finding) => {
                                const si = statusStyles[finding.status as FindingStatus] ?? statusStyles.INFO;
                                const Icon = si.icon;
                                const isSelected = selectedFinding?.id === finding.id;
                                return (
                                  <button
                                    key={finding.id}
                                    onClick={() => handleFindingClick(finding)}
                                    className={`w-full text-left rounded-xl border p-3.5 text-sm transition-all ${
                                      isSelected
                                        ? "border-primary/30 bg-primary/[0.04] shadow-sm"
                                        : "border-border/60 hover:border-border hover:bg-muted/30 hover:shadow-sm"
                                    }`}
                                  >
                                    <div className="flex items-start gap-2.5">
                                      <div className={`mt-0.5 flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full ${si.className}`}>
                                        <Icon className="h-3 w-3" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <Badge
                                            variant="outline"
                                            className={`text-[10px] px-1.5 py-0 font-semibold rounded-md ${si.className}`}
                                          >
                                            {si.label}
                                          </Badge>
                                          <span className="font-medium text-xs truncate">
                                            {finding.label}
                                          </span>
                                        </div>
                                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                                          {finding.detail}
                                        </p>
                                        {finding.extractedText && (
                                          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5">
                                            <Type className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
                                            <span className="text-[11px] text-muted-foreground break-words leading-relaxed">
                                              &ldquo;{finding.extractedText}&rdquo;
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                      {finding.pageNumber && (
                                        <div className="flex shrink-0 items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                                          <MapPin className="h-3 w-3" />
                                          p.{finding.pageNumber}
                                        </div>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>

            {/* Actions */}
            <div className="mt-5 flex gap-3">
              <Button
                onClick={() => {
                  setStep("template");
                  setResultData(null);
                  setBgFile(null);
                  setSelectedTemplateId(null);
                  setValidationId(null);
                }}
                variant="outline"
                className="gap-1.5 rounded-lg"
              >
                New Validation
              </Button>
              <Button onClick={handleDownloadReport} variant="outline" className="gap-1.5 rounded-lg">
                <Download className="h-4 w-4" />
                Download Report
              </Button>
              <Button onClick={() => window.print()} variant="outline" className="gap-1.5 rounded-lg">
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
