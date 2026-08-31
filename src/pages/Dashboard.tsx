import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import {
  Shield,
  LogOut,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  Eye,
  Trash2,
  Clock,
  Search,
  SlidersHorizontal,
  Home,
  Info,
  Sparkles,
  Activity,
  ChevronDown,
  ChevronUp,
  Zap,
  Globe,
  Lock,
  RefreshCw,
  TrendingUp,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router";
import { formatDistanceToNow, format } from "date-fns";

const statusConfig = {
  VALID: {
    label: "Valid",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  REVIEW: {
    label: "Review Required",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  DISCREPANT: {
    label: "Discrepant",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

type StatusFilter = "all" | "VALID" | "REVIEW" | "DISCREPANT";

// ── Live Clock Component ──────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-card px-4 py-2.5 shadow-sm">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
        <Clock className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-bold tabular-nums text-foreground">
          {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {time.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
        </span>
      </div>
    </div>
  );
}

// ── System Pulse (animated dot) ──────────────────────────────
function SystemPulse() {
  const [pulse, setPulse] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setPulse((p) => !p), 2000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-card px-4 py-2.5 shadow-sm">
      <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
        <div className={`absolute h-2.5 w-2.5 rounded-full bg-emerald-500 transition-opacity duration-1000 ${pulse ? "opacity-100" : "opacity-40"}`} />
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-bold text-foreground">All Systems</span>
        <span className="text-[10px] text-emerald-600">Operational</span>
      </div>
    </div>
  );
}

// ── AI Insight Card ──────────────────────────────────────────
function AIInsightCard({ stats }: { stats: { total: number; valid: number; review: number; discrepant: number } | undefined }) {
  const total = stats?.total ?? 0;
  const valid = stats?.valid ?? 0;
  const review = stats?.review ?? 0;
  const fail = stats?.discrepant ?? 0;
  const passRate = total > 0 ? Math.round((valid / total) * 100) : 0;

  const insight = useMemo(() => {
    if (total === 0) return { text: "Upload your first Bank Guarantee to get AI-powered insights.", icon: Sparkles, color: "text-primary" };
    if (fail > 0) return { text: `${fail} document${fail !== 1 ? "s" : ""} with discrepancies need attention. Review flagged items to ensure compliance.`, icon: AlertTriangle, color: "text-amber-600" };
    if (review > 0) return { text: `${review} item${review !== 1 ? "s" : ""} pending manual review. Avg pass rate is ${passRate}% across all validations.`, icon: Activity, color: "text-amber-600" };
    return { text: `Excellent — ${passRate}% pass rate across ${total} validation${total !== 1 ? "s" : ""}. All documents passed compliance checks.`, icon: TrendingUp, color: "text-emerald-600" };
  }, [total, valid, review, fail, passRate]);

  const Icon = insight.icon;

  return (
    <div className="rounded-2xl border border-border/40 bg-gradient-to-br from-card via-card to-primary/[0.03] p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[0.6rem] font-bold uppercase tracking-widest text-primary">AI Insight</span>
            <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
          </div>
          <p className="text-sm leading-relaxed text-foreground/80">{insight.text}</p>
          {total > 0 && (
            <div className="mt-3 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${passRate}%` }} />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground">{passRate}%</span>
              </div>
              <span className="text-[10px] text-muted-foreground">pass rate</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Quick Action Tiles ───────────────────────────────────────
function QuickActions({ onNew, onHistory }: { onNew: () => void; onHistory: () => void }) {
  const actions = [
    { label: "New Validation", sub: "Upload & validate BG", icon: Plus, onClick: onNew, accent: "bg-primary text-primary-foreground" },
    { label: "Validation History", sub: "Browse past reports", icon: FileText, onClick: onHistory, accent: "bg-muted text-foreground" },
    { label: "Help & FAQ", sub: "How BG Validator works", icon: Globe, onClick: () => window.open("/", "_self"), accent: "bg-muted text-foreground" },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={a.onClick}
          className="group flex items-center gap-3 rounded-2xl border border-border/40 bg-card p-4 shadow-sm hover:shadow-md hover:border-border transition-all duration-200 text-left"
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.accent} transition-transform group-hover:scale-105`}>
            <a.icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{a.label}</p>
            <p className="text-[11px] text-muted-foreground truncate">{a.sub}</p>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary ml-auto shrink-0 transition-colors" />
        </button>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const stats = useQuery(api.validations.stats);
  const validations = useQuery(api.validations.list);
  const deleteValidation = useMutation(api.validations.remove);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this validation report?")) {
      await deleteValidation({ id: id as any });
    }
  };

  const filteredValidations = useMemo(() => {
    if (!validations) return [];
    return validations.filter((v) => {
      const matchesSearch =
        searchQuery === "" ||
        v.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.userInstructions && v.userInstructions.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus =
        statusFilter === "all" || v.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [validations, searchQuery, statusFilter]);

  const statCards = [
    {
      label: "Total Validated",
      value: stats?.total ?? 0,
      icon: FileText,
      color: "text-foreground",
      bg: "bg-muted",
      trend: "+2 this week",
      trendUp: true,
    },
    {
      label: "Valid",
      value: stats?.valid ?? 0,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      trend: stats?.total ? `${Math.round(((stats?.valid ?? 0) / Math.max(stats.total, 1)) * 100)}% pass rate` : "—",
      trendUp: true,
    },
    {
      label: "Review Required",
      value: stats?.review ?? 0,
      icon: AlertTriangle,
      color: "text-amber-600",
      bg: "bg-amber-50",
      trend: "Pending manual check",
      trendUp: false,
    },
    {
      label: "Discrepant",
      value: stats?.discrepant ?? 0,
      icon: XCircle,
      color: "text-red-600",
      bg: "bg-red-50",
      trend: "Needs attention",
      trendUp: false,
    },
  ];

  // Count validations with user instructions
  const withInstructions = validations?.filter((v) => v.userInstructions)?.length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg px-2 py-1 -ml-2"
            >
              <Home className="h-4 w-4" />
            </button>
            <div className="h-4 w-px bg-border/50" />
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm shadow-primary/20">
                <Shield className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-bold tracking-tight">
                BG Validator Pro
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LiveClock />
            <SystemPulse />
            <Button
              onClick={() => navigate("/workspace")}
              className="gap-1.5 rounded-lg h-9"
              size="sm"
            >
              <Plus className="h-3.5 w-3.5" />
              New Validation
            </Button>
            <div className="h-4 w-px bg-border" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="gap-1.5 text-muted-foreground rounded-lg h-9"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-8 animate-fade-up">
        {/* Welcome + AI Insight */}
        <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-border/40 bg-gradient-to-br from-card via-card to-muted/20 px-7 py-6 shadow-sm">
            <h1 className="text-[1.6rem] font-bold tracking-tight text-foreground">
              Welcome back{user?.name ? ", " : ""}<span className="text-primary">{user?.name || ""}</span>
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Your validation catalog at a glance
            </p>
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {format(new Date(), "EEEE, MMMM d, yyyy")}
              </div>
              {withInstructions > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg bg-primary/5 px-3 py-1.5 text-xs text-primary">
                  <Zap className="h-3 w-3" />
                  {withInstructions} with custom instructions
                </div>
              )}
            </div>
          </div>
          <AIInsightCard stats={stats} />
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <QuickActions onNew={() => navigate("/workspace")} onHistory={() => {}} />
        </div>

        {/* Stat Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
          {statCards.map((s) => (
            <div
              key={s.label}
              className="group relative rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 hover:border-border"
            >
              <div className={`absolute top-0 left-0 h-full w-1 ${s.bg}`} />
              <div className="pl-6 pr-5 py-5">
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bg} ${s.color} transition-transform duration-200 group-hover:scale-105`}
                  >
                    <s.icon className="h-4.5 w-4.5" />
                  </div>
                </div>
                <p className="text-[1.65rem] font-bold tracking-tight text-foreground leading-none">{s.value}</p>
                <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground mt-1.5">
                  {s.label}
                </p>
                <p className={`mt-2 text-[10px] font-medium ${s.trendUp ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {s.trend}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Validation Catalog */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border/40 bg-muted/20 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Validation Catalog</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{validations?.length ?? 0} validation{(validations?.length ?? 0) !== 1 ? "s" : ""} recorded</p>
                </div>
              </div>
              <Button
                onClick={() => navigate("/workspace")}
                className="gap-1.5 rounded-lg shadow-sm h-9"
                size="sm"
              >
                <Plus className="h-3.5 w-3.5" />
                New Validation
              </Button>
            </div>

            {validations && validations.length > 0 && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center mt-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by filename or instructions…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-9 rounded-xl text-sm bg-background"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground/50 hidden sm:block mr-1" />
                  {(["all", "VALID", "REVIEW", "DISCREPANT"] as StatusFilter[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        statusFilter === s
                          ? s === "all"
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : s === "VALID"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : s === "REVIEW"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
                      }`}
                    >
                      {s === "all" ? "All" : s === "VALID" ? "Valid" : s === "REVIEW" ? "Review" : "Discrepant"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="p-0">
            {validations && validations.length === 0 ? (
              <div className="py-20 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-muted/60 to-muted/30">
                  <FileText className="h-7 w-7 text-muted-foreground/60" />
                </div>
                <p className="text-sm font-semibold text-foreground">No validations yet</p>
                <p className="mt-1.5 text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  Upload a reference template, then submit a Bank Guarantee to see your first validation report here.
                </p>
                <Button
                  onClick={() => navigate("/workspace")}
                  className="mt-6 gap-1.5 rounded-lg shadow-sm"
                  size="sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Validation
                </Button>
              </div>
            ) : filteredValidations.length === 0 ? (
              <div className="py-16 text-center">
                <Search className="mx-auto mb-4 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-foreground/70">No results found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try adjusting your search or filter criteria.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {filteredValidations.map((v) => {
                  const statusInfo =
                    statusConfig[v.status as keyof typeof statusConfig] || statusConfig.REVIEW;
                  const isExpanded = expandedRow === v._id;
                  const hasInstructions = !!v.userInstructions;
                  const validationDate = format(new Date(v.createdAt), "MMM d, yyyy");
                  const validationTime = format(new Date(v.createdAt), "h:mm a");

                  // Generate a short instruction answer summary
                  const instructionSummary = useMemo(() => {
                    if (!v.userInstructions) return null;
                    const instructions = v.userInstructions.split(";").filter(Boolean);
                    if (v.status === "VALID") return { verdict: "All instruction checks passed", type: "pass" as const };
                    if (v.status === "DISCREPANT") return { verdict: `${v.failCount} discrepancy(ies) found against your instructions`, type: "fail" as const };
                    return { verdict: `${v.reviewCount} item(s) need review per your instructions`, type: "review" as const };
                  }, [v.userInstructions, v.status, v.failCount, v.reviewCount]);

                  return (
                    <div key={v._id} className="group">
                      <div
                        className="flex items-center gap-4 px-6 py-4 hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => navigate(`/results/${v._id}`)}
                      >
                        {/* Document icon + name */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground group-hover:bg-primary/[0.08] group-hover:text-primary transition-colors">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{v.filename}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-muted-foreground">{v.documentType}</span>
                              <span className="text-muted-foreground/30">·</span>
                              <span className="text-[11px] text-muted-foreground">{v.pageCount} page{v.pageCount !== 1 ? "s" : ""}</span>
                              {hasInstructions && (
                                <>
                                  <span className="text-muted-foreground/30">·</span>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                                    <Zap className="h-2.5 w-2.5" />
                                    Custom
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Date */}
                        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                          <Calendar className="h-3 w-3 text-muted-foreground/50" />
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-foreground/80">{validationDate}</span>
                            <span className="text-[10px] text-muted-foreground">{validationTime}</span>
                          </div>
                        </div>

                        {/* Status */}
                        <div className="shrink-0">
                          <Badge
                            variant="outline"
                            className={`${statusInfo.className} font-semibold rounded-lg text-[0.65rem] uppercase tracking-wider px-2.5 py-0.5`}
                          >
                            {statusInfo.label}
                          </Badge>
                        </div>

                        {/* Counts */}
                        <div className="hidden md:flex items-center gap-1.5 shrink-0">
                          <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-lg bg-emerald-50 px-2 text-[0.65rem] font-bold text-emerald-700">
                            {v.passCount}
                          </span>
                          <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-lg bg-amber-50 px-2 text-[0.65rem] font-bold text-amber-700">
                            {v.reviewCount}
                          </span>
                          <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-lg bg-red-50 px-2 text-[0.65rem] font-bold text-red-700">
                            {v.failCount}
                          </span>
                        </div>

                        {/* Instruction answer summary (compact) */}
                        {hasInstructions && instructionSummary && (
                          <div className="hidden lg:block shrink-0 max-w-[220px]">
                            <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-medium ${
                              instructionSummary.type === "pass" ? "bg-emerald-50 text-emerald-700" :
                              instructionSummary.type === "fail" ? "bg-red-50 text-red-700" :
                              "bg-amber-50 text-amber-700"
                            }`}>
                              {instructionSummary.type === "pass" && <CheckCircle2 className="h-2.5 w-2.5" />}
                              {instructionSummary.type === "fail" && <XCircle className="h-2.5 w-2.5" />}
                              {instructionSummary.type === "review" && <AlertTriangle className="h-2.5 w-2.5" />}
                              <span className="truncate">{instructionSummary.verdict}</span>
                            </div>
                          </div>
                        )}

                        {/* Expand + Actions */}
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {hasInstructions && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedRow(isExpanded ? null : v._id);
                              }}
                            >
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-all"
                            onClick={() => navigate(`/results/${v._id}`)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-destructive/40 hover:text-destructive opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-all"
                            onClick={() => handleDelete(v._id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Expanded instruction details */}
                      {isExpanded && hasInstructions && (
                        <div className="border-t border-border/30 bg-muted/10 px-6 py-4 animate-in slide-in-from-top-2">
                          <div className="grid gap-4 lg:grid-cols-2">
                            {/* User Instructions */}
                            <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                                  <Info className="h-3 w-3 text-primary" />
                                </div>
                                <span className="text-[0.6rem] font-bold uppercase tracking-widest text-primary">Your Instructions</span>
                              </div>
                              <p className="text-sm text-foreground/80 leading-relaxed">{v.userInstructions}</p>
                            </div>

                            {/* Response Summary */}
                            <div className={`rounded-xl border p-4 ${
                              instructionSummary?.type === "pass" ? "border-emerald-200 bg-emerald-50/30" :
                              instructionSummary?.type === "fail" ? "border-red-200 bg-red-50/30" :
                              "border-amber-200 bg-amber-50/30"
                            }`}>
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`flex h-6 w-6 items-center justify-center rounded-md ${
                                  instructionSummary?.type === "pass" ? "bg-emerald-100" :
                                  instructionSummary?.type === "fail" ? "bg-red-100" :
                                  "bg-amber-100"
                                }`}>
                                  {instructionSummary?.type === "pass" && <CheckCircle2 className="h-3 w-3 text-emerald-700" />}
                                  {instructionSummary?.type === "fail" && <XCircle className="h-3 w-3 text-red-700" />}
                                  {instructionSummary?.type === "review" && <AlertTriangle className="h-3 w-3 text-amber-700" />}
                                </div>
                                <span className="text-[0.6rem] font-bold uppercase tracking-widest text-foreground/70">Validation Response</span>
                              </div>
                              <p className="text-sm font-medium text-foreground/90">{instructionSummary?.verdict}</p>
                              <div className="mt-3 flex items-center gap-3">
                                <div className="flex items-center gap-1 text-[10px]">
                                  <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                                  <span className="font-semibold text-emerald-700">{v.passCount} pass</span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px]">
                                  <AlertTriangle className="h-2.5 w-2.5 text-amber-600" />
                                  <span className="font-semibold text-amber-700">{v.reviewCount} review</span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px]">
                                  <XCircle className="h-2.5 w-2.5 text-red-600" />
                                  <span className="font-semibold text-red-700">{v.failCount} fail</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 flex items-center justify-between text-[10px] text-muted-foreground/50">
          <div className="flex items-center gap-2">
            <Lock className="h-2.5 w-2.5" />
            <span>Encrypted · All data stored securely</span>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-2.5 w-2.5" />
            <span>Live · Auto-refreshing</span>
          </div>
        </div>
      </main>
    </div>
  );
}
