import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "lucide-react";
import { useNavigate } from "react-router";
import { formatDistanceToNow } from "date-fns";

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

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const stats = useQuery(api.validations.stats);
  const validations = useQuery(api.validations.list);
  const deleteValidation = useMutation(api.validations.remove);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

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
        v.filename.toLowerCase().includes(searchQuery.toLowerCase());
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
    },
    {
      label: "Valid",
      value: stats?.valid ?? 0,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Review Required",
      value: stats?.review ?? 0,
      icon: AlertTriangle,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Discrepant",
      value: stats?.discrepant ?? 0,
      icon: XCircle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ];

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
        <div className="mb-8 rounded-2xl border border-border/40 bg-gradient-to-br from-card via-card to-muted/20 px-7 py-6 shadow-sm">
          <h1 className="text-[1.6rem] font-bold tracking-tight text-foreground">
            Welcome back{user?.name ? ", " : ""}<span className="text-primary">{user?.name || ""}</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Your validation catalog at a glance
          </p>
        </div>

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
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border/40 bg-muted/20 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Validation Catalog</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{validations?.length ?? 0} validation{(validations?.length ?? 0) !== 1 ? 's' : ''} recorded</p>
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by filename…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-9 rounded-xl text-sm bg-background"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground/50 hidden sm:block mr-1" />
                  {(
                    ["all", "VALID", "REVIEW", "DISCREPANT"] as StatusFilter[]
                  ).map((s) => (
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
                      {s === "all"
                        ? "All"
                        : s === "VALID"
                          ? "Valid"
                          : s === "REVIEW"
                            ? "Review"
                            : "Discrepant"}
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/40">
                      <TableHead className="font-semibold text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                        Document
                      </TableHead>
                      <TableHead className="font-semibold text-[0.65rem] uppercase tracking-wider text-muted-foreground">Date</TableHead>
                      <TableHead className="font-semibold text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                        Status
                      </TableHead>
                      <TableHead className="text-center font-semibold text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                        Pass
                      </TableHead>
                      <TableHead className="text-center font-semibold text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                        Review
                      </TableHead>
                      <TableHead className="text-center font-semibold text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                        Fail
                      </TableHead>
                      <TableHead className="text-right font-semibold text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredValidations.map((v) => {
                      const statusInfo =
                        statusConfig[
                          v.status as keyof typeof statusConfig
                        ] || statusConfig.REVIEW;
                      return (
                        <TableRow
                          key={v._id}
                          className="group cursor-pointer border-border/30 hover:bg-muted/30 transition-colors"
                          onClick={() => navigate(`/results/${v._id}`)}
                        >
                          <TableCell className="font-medium max-w-[240px] py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground group-hover:bg-primary/[0.08] group-hover:text-primary transition-colors">
                                <FileText className="h-4 w-4" />
                              </div>
                              <span className="truncate text-sm font-medium">{v.filename}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap py-3.5">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 text-muted-foreground/50" />
                              <span className="text-xs">{formatDistanceToNow(v.createdAt, { addSuffix: true })}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3.5">
                            <Badge
                              variant="outline"
                              className={`${statusInfo.className} font-semibold rounded-lg text-[0.65rem] uppercase tracking-wider px-2.5 py-0.5`}
                            >
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center py-3.5">
                            <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-lg bg-emerald-50 px-2.5 text-[0.65rem] font-bold text-emerald-700">
                              {v.passCount}
                            </span>
                          </TableCell>
                          <TableCell className="text-center py-3.5">
                            <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-lg bg-amber-50 px-2.5 text-[0.65rem] font-bold text-amber-700">
                              {v.reviewCount}
                            </span>
                          </TableCell>
                          <TableCell className="text-center py-3.5">
                            <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-lg bg-red-50 px-2.5 text-[0.65rem] font-bold text-red-700">
                              {v.failCount}
                            </span>
                          </TableCell>
                          <TableCell className="text-right py-3.5">
                            <div
                              className="flex items-center justify-end gap-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-all"
                                onClick={() =>
                                  navigate(`/results/${v._id}`)
                                }
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
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
