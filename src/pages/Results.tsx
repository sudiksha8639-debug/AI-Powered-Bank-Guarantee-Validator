import { useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import type { FindingStatus, FindingCategory } from "@/lib/types";
import { generateReport } from "@/lib/pdf-report";
import {
  Shield,
  ArrowLeft,
  Download,
  Printer,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  MapPin,
  Type,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

const statusStyles: Record<FindingStatus, { icon: any; className: string; label: string }> = {
  PASS: { icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "PASS" },
  REVIEW: { icon: AlertTriangle, className: "bg-amber-50 text-amber-700 border-amber-200", label: "REVIEW" },
  FAIL: { icon: XCircle, className: "bg-red-50 text-red-700 border-red-200", label: "FAIL" },
  INFO: { icon: Info, className: "bg-blue-50 text-blue-700 border-blue-200", label: "INFO" },
};

const categoryOrder: FindingCategory[] = [
  "Clause Validation",
  "Consistency Validation",
  "Logical Validation",
  "Document Validation",
  "Optional Information",
];

const statusOrder: FindingStatus[] = ["PASS", "REVIEW", "FAIL", "INFO"];

const overallStatusConfig: Record<string, { className: string; label: string }> = {
  VALID: { className: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "VALID" },
  REVIEW: { className: "bg-amber-50 text-amber-700 border-amber-200", label: "REVIEW REQUIRED" },
  DISCREPANT: { className: "bg-red-50 text-red-700 border-red-200", label: "DISCREPANT" },
};

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const validation = useQuery(api.validations.get, id ? { id: id as any } : "skip");
  const findings = useQuery(api.validations.getFindings, id ? { validationId: id as any } : "skip");

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedFinding, setSelectedFinding] = useState<any>(null);

  const filteredFindings = findings?.filter((f) => {
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

  const statusCounts = findings
    ? {
        PASS: findings.filter((f) => f.status === "PASS").length,
        REVIEW: findings.filter((f) => f.status === "REVIEW").length,
        FAIL: findings.filter((f) => f.status === "FAIL").length,
        INFO: findings.filter((f) => f.status === "INFO").length,
      }
    : null;

  const handleFindingClick = useCallback((finding: any) => {
    setSelectedFinding(finding);
  }, []);

  const handleDownloadReport = () => {
    if (!validation || !findings) return;
    generateReport(
      {
        status: validation.status,
        documentType: validation.documentType,
        pageCount: validation.pageCount,
        passCount: validation.passCount,
        reviewCount: validation.reviewCount,
        failCount: validation.failCount,
        infoCount: validation.infoCount,
        findings: findings.map((f) => ({
          id: f._id,
          category: f.category,
          checkId: f.checkId,
          label: f.label,
          status: f.status,
          detail: f.detail,
          pageNumber: f.pageNumber,
          extractedText: f.extractedText,
        })),
      },
      validation.filename,
      validation.filename,
      format(validation.createdAt, "PPP"),
      validation.userInstructions || undefined,
    );
  };

  if (!validation || !findings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin h-6 w-6 border-2 border-primary/20 border-t-primary rounded-full" />
          <span className="text-sm text-muted-foreground font-medium">Loading report…</span>
        </div>
      </div>
    );
  }

  const statusInfo = overallStatusConfig[validation.status] ?? overallStatusConfig.REVIEW;

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg px-2 py-1 -ml-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Catalog
            </button>
            <div className="h-4 w-px bg-border/60" />
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm shadow-primary/20">
                <Shield className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-bold tracking-tight">BG Validator Pro</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadReport} className="gap-1.5 rounded-lg">
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 rounded-lg">
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-[1600px] px-6 py-6">
        {/* Header */}
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight">{validation.filename}</h1>
              <Badge
                variant="outline"
                className={`${statusInfo.className} font-semibold rounded-md px-2.5 py-0.5`}
              >
                {statusInfo.label}
              </Badge>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Validated {format(validation.createdAt, "PPP")} · {validation.documentType} ·{" "}
              {validation.pageCount} page{validation.pageCount !== 1 ? "s" : ""}
            </p>
          </div>            <div className="flex gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span className="font-semibold text-emerald-700">{validation.passCount}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              <span className="font-semibold text-amber-700">{validation.reviewCount}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm">
              <XCircle className="h-3.5 w-3.5 text-red-600" />
              <span className="font-semibold text-red-700">{validation.failCount}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm">
              <Info className="h-3.5 w-3.5 text-blue-600" />
              <span className="font-semibold text-blue-700">{validation.infoCount}</span>
            </div>
          </div>
        </div>

        {validation.userInstructions && (
          <div className="mb-5 rounded-xl border border-primary/20 bg-primary/[0.04] px-5 py-4">
            <div className="flex items-start gap-2.5">
              <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Additional Instructions</p>
                <p className="mt-1 text-sm text-foreground/80">{validation.userInstructions}</p>
              </div>
            </div>
          </div>
        )}

        {/* Split View */}
        <ResizablePanelGroup direction="horizontal" className="rounded-xl border border-border/60 bg-card shadow-sm min-h-[600px]">
          {/* Left: Extracted text */}
          <ResizablePanel defaultSize={50} minSize={35}>
            <div className="flex h-full flex-col border-r border-border/60">
              <div className="flex items-center gap-2 border-b border-border/40 bg-muted/30 px-4 py-2.5">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Extracted Text</span>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-6">
                  <div className="rounded-xl border border-border/40 bg-muted/20 p-6 font-mono text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap">
                    {validation.extractedText || "No text was extracted from this document."}
                  </div>
                </div>
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
                    <span className="opacity-60">({findings.length})</span>
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
                  const count = findings.filter((f) => f.category === cat).length;
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
                            const isSelected = selectedFinding?._id === finding._id;
                            return (
                              <button
                                key={finding._id}
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
          <Button onClick={() => navigate("/workspace")} variant="outline" className="gap-1.5 rounded-lg">
            <ArrowRight className="h-4 w-4" />
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
      </main>
    </div>
  );
}
