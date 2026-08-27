import { useState, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  Shield,
  ArrowRight,
  CheckCircle2,
  Upload,
  FileText,
  BarChart3,
  ChevronRight,
  Lock,
  Zap,
  Eye,
  Search,
  Plus,
  Minus,
  Linkedin,
  Twitter,
  Github,
  Mail,
  Globe,
} from "lucide-react";
import { useNavigate } from "react-router";

/* ─── Animation Variants ─────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

/* ─── Animated Section Wrapper ───────────────────────── */

function AnimatedSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={{
        hidden: { opacity: 0, y: 30 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Data ───────────────────────────────────────────── */

const workflow = [
  {
    icon: Upload,
    title: "Load a Template",
    desc: "Upload your standard Bank Guarantee template. It becomes the reference against which every document is measured.",
  },
  {
    icon: FileText,
    title: "Submit a Guarantee",
    desc: "Drag in a Bank Guarantee PDF, Word document, scanned image, or plain text file — the system handles the rest.",
  },
  {
    icon: Search,
    title: "Validate Automatically",
    desc: "Text is extracted and cross-checked clause by clause, value by value. OCR runs on scanned pages without manual setup.",
  },
  {
    icon: BarChart3,
    title: "Review the Report",
    desc: "Browse findings alongside the original document. Every check is tagged Pass, Review, Fail, or Info with page references.",
  },
];

const stats = [
  { label: "Validation Checks", value: "22+", icon: Eye },
  { label: "Formats Supported", value: "6+", icon: FileText },
  { label: "Processing Time", value: "Seconds", icon: Zap },
  { label: "Security Model", value: "Encrypted", icon: Lock },
];

const faqItems = [
  {
    q: "What is BG Validator Pro?",
    a: "BG Validator Pro is an AI-powered document validation tool that compares Bank Guarantee documents against a reference template. It automatically detects discrepancies in clauses, amounts, dates, parties, and structural elements — flagging issues before they become compliance risks.",
  },
  {
    q: "Who can use it?",
    a: "It is designed for compliance teams, legal departments, treasury operations, and any organization that issues or receives Bank Guarantees regularly. It works as an internal team tool with secure, account-based access.",
  },
  {
    q: "Can companies use it for multiple Bank Guarantees?",
    a: "Yes. You can upload a single reference template and validate any number of Bank Guarantee documents against it. All validation reports are stored in your account for audit and review.",
  },
  {
    q: "Can it process scanned PDFs?",
    a: "Yes. The system automatically detects whether a document is digital or scanned. Scanned pages are processed through OCR with low-resolution enhancement, so even poor-quality scans produce usable text for validation.",
  },
  {
    q: "What do PASS, REVIEW, and FAIL mean?",
    a: "PASS means the check was successful and the value matches expectations. REVIEW means something was found that requires manual verification — it may be intentional or an error. FAIL means a clear discrepancy was detected, such as a missing clause or mismatched amount.",
  },
  {
    q: "Does additional bank information automatically count as an error?",
    a: "No. IFSC codes, SWIFT/BIC codes, branch details, email addresses, and phone numbers are detected as optional bank-specific information and reported as INFO — never as failures. The system distinguishes between required template content and optional additions.",
  },
];

const featureSections = [
  {
    title: "Clause-Level Precision",
    description:
      "Every clause in your reference template is extracted, indexed, and compared against the submitted document using similarity scoring.",
    items: [
      "Numbered clause detection",
      "Section and article matching",
      "Bigram similarity scoring",
      "Ordering consistency checks",
    ],
  },
  {
    title: "Consistency Verification",
    description:
      "Cross-reference amounts, dates, contract references, beneficiary names, and issuing bank details between the template and the submitted guarantee.",
    items: [
      "Amount in words vs figures",
      "Currency consistency",
      "Date format and ordering",
      "BG number and contract references",
    ],
  },
  {
    title: "Document Intelligence",
    description:
      "Automatic digital-vs-scanned detection, adaptive OCR for low-quality scans, and layout structure analysis ensure every document is processed correctly.",
    items: [
      "Auto-detect digital, scanned, or mixed",
      "Low-resolution enhancement before OCR",
      "Per-page confidence scoring",
      "Signature, stamp, and authorization detection",
    ],
  },
];

/* ─── FAQ Component ─────────────────────────────────── */

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-white/20 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left text-[0.95rem] font-medium text-foreground/90 hover:text-foreground transition-colors"
      >
        {q}
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/10 text-muted-foreground"
        >
          {open ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-[0.88rem] leading-relaxed text-muted-foreground">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Main Landing Page ─────────────────────────────── */

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen overflow-x-hidden bg-white">

        {/* ─── Navigation ─────────────────────────────── */}
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="sticky top-0 z-50 border-b border-black/5 bg-white/40 backdrop-blur-xl"
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
                <Shield className="h-4 w-4 text-background" />
              </div>
              <span className="text-sm font-bold tracking-tight text-foreground">
                BG Validator Pro
              </span>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="#faq"
                className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                FAQ
              </a>
              {isAuthenticated ? (
                <Button
                  size="sm"
                  onClick={() => navigate("/dashboard")}
                  className="gap-1.5 rounded-full bg-foreground text-background hover:bg-foreground/90"
                >
                  Open Dashboard
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/auth")}
                    className="rounded-full"
                  >
                    Sign In
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => navigate("/auth")}
                    className="gap-1.5 rounded-full bg-foreground text-background hover:bg-foreground/90"
                  >
                    Get Started
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </motion.nav>

        {/* ─── Hero — Editorial Stagger (matching Motion.dev screenshot) ── */}
        <section className="relative overflow-hidden" style={{ background: "linear-gradient(160deg, #fef7ed 0%, #fde8d4 20%, #fef1e6 40%, #fef9ee 60%, #f0fdf4 80%, #ecfdf5 100%)" }}>
          {/* Floating soft orbs for depth */}
          <motion.div
            className="absolute top-10 right-[10%] w-[500px] h-[500px] rounded-full blur-[120px] opacity-50"
            style={{ background: "radial-gradient(circle, rgba(251,191,36,0.3), transparent 70%)" }}
            animate={{ x: [0, -15, 0], y: [0, 10, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-0 left-[5%] w-[400px] h-[400px] rounded-full blur-[100px] opacity-40"
            style={{ background: "radial-gradient(circle, rgba(251,191,36,0.2), transparent 70%)" }}
            animate={{ x: [0, 12, 0], y: [0, -8, 0] }}
            transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative mx-auto max-w-6xl px-6 pb-28 pt-24 lg:pt-32">
            <div className="max-w-3xl">
              {/* Staggered heading reveal — large editorial style */}
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                <motion.h1
                  variants={staggerItem}
                  className="text-[2.75rem] font-bold tracking-tight leading-[1.08] sm:text-5xl lg:text-[3.8rem] text-foreground"
                >
                  Validate Bank Guarantees
                </motion.h1>
                <motion.h1
                  variants={staggerItem}
                  className="text-[2.75rem] font-bold tracking-tight leading-[1.08] sm:text-5xl lg:text-[3.8rem] text-muted-foreground/60"
                >
                  with confidence.
                </motion.h1>
              </motion.div>

              <motion.p
                variants={fadeUp}
                custom={2}
                initial="hidden"
                animate="visible"
                className="mt-7 max-w-xl text-[1.05rem] leading-relaxed text-muted-foreground"
              >
                A precision validation tool for teams that review Bank Guarantee
                documents. Upload a template, submit a guarantee, and get a
                structured report of every discrepancy, missing clause, and
                inconsistency — in seconds.
              </motion.p>

              <motion.div
                variants={fadeUp}
                custom={3}
                initial="hidden"
                animate="visible"
                className="mt-10 flex flex-wrap items-center gap-3"
              >
                <Button
                  size="lg"
                  onClick={() =>
                    navigate(isAuthenticated ? "/dashboard" : "/auth")
                  }
                  className="gap-2 rounded-full px-8 bg-foreground text-background hover:bg-foreground/90 shadow-lg"
                >
                  Get started
                  <motion.span
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </motion.span>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() =>
                    document
                      .getElementById("workflow")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="rounded-full px-8 border-black/10 bg-white/50 backdrop-blur-sm hover:bg-white/70"
                >
                  See How It Works
                </Button>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ─── Stats Bar ─────────────────────────────── */}
        <AnimatedSection>
          <section className="border-y border-border/50 bg-white">
            <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px lg:grid-cols-4">
              {stats.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="flex items-center justify-center gap-3 px-6 py-5"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/60 text-muted-foreground shadow-sm">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-lg font-bold leading-tight text-foreground">
                      {s.value}
                    </span>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        </AnimatedSection>

        {/* ─── Workflow ─────────────────────────────── */}
        <section id="workflow" className="py-28 bg-gray-50/50">
          <div className="mx-auto max-w-6xl px-6">
            <AnimatedSection>
              <div className="mb-14">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  How It Works
                </p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                  From document to verdict in four steps
                </h2>
                <p className="mt-3 max-w-lg text-sm text-muted-foreground">
                  Built for compliance reviewers, legal teams, and anyone who
                  needs to verify Bank Guarantee documents quickly and thoroughly.
                </p>
              </div>
            </AnimatedSection>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {workflow.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="relative rounded-2xl border border-black/5 bg-white/60 backdrop-blur-sm p-5 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/80 text-foreground shadow-sm">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <div className="absolute right-4 top-4 text-3xl font-bold text-foreground/[0.04]">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="text-[0.95rem] font-semibold text-foreground mb-2">
                    {f.title}
                  </h3>
                  <p className="text-[0.85rem] leading-relaxed text-muted-foreground">
                    {f.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Feature Sections ─────────────────────────────── */}
        <section className="border-y border-border/50 py-28 bg-gray-50/80">
          <div className="mx-auto max-w-6xl px-6">
            <AnimatedSection>
              <div className="mb-14">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  What Gets Checked
                </p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                  Every clause, every value,
                  <br />
                  every detail
                </h2>
                <p className="mt-3 max-w-lg text-sm text-muted-foreground">
                  The validation engine compares your document against the
                  template using a systematic, multi-category approach — catching
                  inconsistencies that manual review typically misses.
                </p>
              </div>
            </AnimatedSection>

            <div className="grid gap-10 lg:grid-cols-3">
              {featureSections.map((section, i) => (
                <motion.div
                  key={section.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12, duration: 0.5 }}
                >
                  <h3 className="text-lg font-semibold tracking-tight text-foreground mb-3">
                    {section.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground mb-5">
                    {section.description}
                  </p>
                  <div className="space-y-2.5">
                    {section.items.map((item, j) => (
                      <motion.div
                        key={item}
                        initial={{ opacity: 0, x: -12 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.12 + j * 0.06, duration: 0.4 }}
                        className="flex items-center gap-2.5 text-sm text-foreground"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{item}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FAQ (matching faq-plus-minus screenshot) ────── */}
        <section id="faq" className="py-28 bg-gray-50/50">
          <div className="mx-auto max-w-3xl px-6">
            <AnimatedSection>
              <div className="mb-10 text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  FAQ
                </p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
                  Clear answers.
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  The practical details teams ask before going live. Can't find
                  yours? Reach out to your team lead.
                </p>
              </div>
            </AnimatedSection>

            <AnimatedSection delay={0.1}>
              <div className="rounded-2xl border border-black/5 bg-white/70 backdrop-blur-sm px-6 shadow-sm">
                {faqItems.map((item) => (
                  <FaqItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* ─── CTA ─────────────────────────────── */}
        <AnimatedSection>
          <section className="border-y border-border/50 py-20 bg-white">
            <div className="mx-auto max-w-6xl px-6 text-center">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Ready to validate your documents?
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
                Load a template, submit a Bank Guarantee, and receive a
                structured compliance report with every finding categorized and
                page-referenced.
              </p>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-block mt-8"
              >
                <Button
                  size="lg"
                  onClick={() =>
                    navigate(isAuthenticated ? "/dashboard" : "/auth")
                  }
                  className="gap-2 rounded-full px-8 bg-foreground text-background hover:bg-foreground/90 shadow-lg"
                >
                  Open BG Validator Pro
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </motion.div>
            </div>
          </section>
        </AnimatedSection>

        {/* ─── Footer — Dark ────── */}
        <footer className="bg-[#0a0a0a] text-white">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                    <Shield className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-bold tracking-tight text-white">
                    BG Validator Pro
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-white/50 max-w-sm">
                  AI-powered Bank Guarantee validation for compliance teams.
                  Upload a template, submit a guarantee, and get a structured
                  report of every discrepancy and inconsistency.
                </p>
                <div className="mt-5 flex items-center gap-2 text-xs text-white/50">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  All systems operational
                </div>
                {/* Social icons */}
                <div className="mt-6 flex items-center gap-3">
                  {[
                    { icon: Linkedin, href: "#", label: "LinkedIn" },
                    { icon: Twitter, href: "#", label: "Twitter" },
                    { icon: Github, href: "#", label: "GitHub" },
                    { icon: Mail, href: "mailto:support@bgvalidator.pro", label: "Email" },
                    { icon: Globe, href: "#", label: "Website" },
                  ].map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/40 transition-all hover:bg-white/10 hover:text-white"
                    >
                      <s.icon className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-4">
                  Product
                </h4>
                <ul className="space-y-2.5 text-sm text-white/40">
                  <li>
                    <button onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")} className="hover:text-white transition-colors">
                      Dashboard
                    </button>
                  </li>
                  <li>
                    <button onClick={() => navigate("/workspace")} className="hover:text-white transition-colors">
                      New Validation
                    </button>
                  </li>
                  <li><a href="#workflow" className="hover:text-white transition-colors">Features</a></li>
                  <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-4">
                  How It Works
                </h4>
                <ul className="space-y-2.5 text-sm text-white/40">
                  <li><a href="#workflow" className="hover:text-white transition-colors">Step 1: Template</a></li>
                  <li><a href="#workflow" className="hover:text-white transition-colors">Step 2: Upload</a></li>
                  <li><a href="#workflow" className="hover:text-white transition-colors">Step 3: Validate</a></li>
                  <li><a href="#workflow" className="hover:text-white transition-colors">Step 4: Report</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-4">
                  Support
                </h4>
                <ul className="space-y-2.5 text-sm text-white/40">
                  <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
                  <li><a href="mailto:support@bgvalidator.pro" className="hover:text-white transition-colors">Contact Support</a></li>
                  <li><span className="cursor-default hover:text-white transition-colors">Privacy Policy</span></li>
                  <li><span className="cursor-default hover:text-white transition-colors">Terms of Service</span></li>
                </ul>
              </div>
            </div>

            <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-white/30 sm:flex-row">
              <span>© {new Date().getFullYear()} BG Validator Pro. Internal team tool.</span>
              <div className="flex items-center gap-4">
                <span className="cursor-default hover:text-white/60 transition-colors">Privacy</span>
                <span className="cursor-default hover:text-white/60 transition-colors">Terms</span>
                <span className="cursor-default hover:text-white/60 transition-colors">Security</span>
              </div>
            </div>
          </div>
        </footer>
    </div>
  );
}
