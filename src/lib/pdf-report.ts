import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Finding = {
  id: string;
  category: string;
  checkId: string;
  label: string;
  status: string;
  detail: string;
  pageNumber?: number;
  extractedText?: string;
};

type ValidationResult = {
  status: string;
  documentType: string;
  pageCount: number;
  passCount: number;
  reviewCount: number;
  failCount: number;
  infoCount: number;
  findings: Finding[];
};

/* ================================================================
   STATUS COLOURS
   ================================================================ */

const STATUS_COLORS: Record<string, [number, number, number]> = {
  PASS: [22, 163, 74],
  REVIEW: [214, 158, 46],
  FAIL: [220, 38, 38],
  INFO: [37, 99, 235],
};

const STATUS_BG: Record<string, [number, number, number]> = {
  PASS: [220, 252, 231],
  REVIEW: [254, 249, 195],
  FAIL: [254, 226, 226],
  INFO: [219, 234, 254],
};

const CATEGORIES = [
  "Clause Validation",
  "Consistency Validation",
  "Logical Validation",
  "Document Validation",
  "Optional Information",
];

/* ================================================================
   USER INSTRUCTION RESPONSE GENERATOR
   ================================================================ */

function generateInstructionResponses(
  userInstructions: string,
  findings: Finding[],
): { instruction: string; response: string; relevantFindings: Finding[] }[] {
  const instructions = userInstructions
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  return instructions.map((instruction) => {
    const lower = instruction.toLowerCase();

    // Keywords to match against findings
    const keywordMap: Record<string, string[]> = {
      amount: ["amount", "figures", "words", "currency", "rupees", "lakh", "crore", "value", "sum"],
      beneficiary: ["beneficiary", "favour", "favor", "payee"],
      bank: ["bank", "issuing", "institution", "branch"],
      date: ["date", "expiry", "claim", "validity", "period", "issue"],
      signature: ["signature", "signatory", "authorized", "authorised", "signing"],
      stamp: ["stamp", "estamp", "e-stamp", "duty"],
      clause: ["clause", "paragraph", "condition", "terms"],
      contract: ["contract", "po", "purchase order", "loa", "foa", "reference"],
      bg: ["guarantee", "bg number", "guarantee number"],
      irrevocable: ["irrevocable", "revocable"],
      unconditional: ["unconditional", "conditional"],
      demand: ["demand", "first demand", "on demand"],
      jurisdiction: ["jurisdiction", "governing law", "delhi", "court"],
    };

    // Find relevant findings
    const relevantFindings: Finding[] = [];
    const matchedKeywords = new Set<string>();

    for (const [concept, keywords] of Object.entries(keywordMap)) {
      const matches = keywords.some((kw) => lower.includes(kw));
      if (matches) {
        matchedKeywords.add(concept);
        // Find matching findings
        for (const f of findings) {
          const fLower = (f.label + " " + f.detail + " " + f.checkId).toLowerCase();
          if (keywords.some((kw) => fLower.includes(kw))) {
            if (!relevantFindings.find((rf) => rf.id === f.id)) {
              relevantFindings.push(f);
            }
          }
        }
      }
    }

    // If no specific match, include all non-PASS findings as context
    if (relevantFindings.length === 0) {
      const issues = findings.filter((f) => f.status === "REVIEW" || f.status === "FAIL");
      relevantFindings.push(...issues.slice(0, 5));
    }

    // Generate response
    const passItems = relevantFindings.filter((f) => f.status === "PASS");
    const reviewItems = relevantFindings.filter((f) => f.status === "REVIEW");
    const failItems = relevantFindings.filter((f) => f.status === "FAIL");

    let response = "";

    if (failItems.length > 0) {
      response += `DISCREPANCIES FOUND: ${failItems.length} check(s) failed for this requirement. `;
      for (const f of failItems) {
        response += `${f.label}: ${f.detail} `;
      }
    }

    if (reviewItems.length > 0) {
      response += `REVIEW REQUIRED: ${reviewItems.length} check(s) need manual verification. `;
      for (const f of reviewItems) {
        response += `${f.label}: ${f.detail} `;
      }
    }

    if (passItems.length > 0) {
      response += `PASSED: ${passItems.length} check(s) confirmed. `;
      for (const f of passItems) {
        response += `${f.label}. `;
      }
    }

    if (!response) {
      response =
        "No specific automated findings directly match this instruction. " +
        "Manual review is recommended for this requirement.";
    }

    return { instruction, response: response.trim(), relevantFindings };
  });
}

/* ================================================================
   MAIN REPORT GENERATOR
   ================================================================ */

export function generateReport(
  result: ValidationResult,
  filename: string,
  templateName: string,
  date: string,
  userInstructions?: string,
  filteredFindings?: Finding[],
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = 0;

  // Compute filtered counts when applicable
  const reportFindings = filteredFindings || result.findings;
  const reportPass = reportFindings.filter((f) => f.status === "PASS").length;
  const reportReview = reportFindings.filter((f) => f.status === "REVIEW").length;
  const reportFail = reportFindings.filter((f) => f.status === "FAIL").length;
  const reportInfo = reportFindings.filter((f) => f.status === "INFO").length;

  /* ─── Helpers ─── */
  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 20) {
      doc.addPage();
      y = 20;
    }
  };

  const drawSectionHeading = (title: string) => {
    ensureSpace(18);
    y += 4;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + contentW, y);
    y += 8;
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(25, 35, 50);
    doc.text(title, margin, y);
    y += 7;
  };

  const drawCheckCard = (finding: Finding) => {
    const status = finding.status.toUpperCase();
    const color = STATUS_COLORS[status] || STATUS_COLORS.INFO;
    const bg = STATUS_BG[status] || STATUS_BG.INFO;

    const label = finding.label || finding.checkId || "Check";
    const detail = finding.detail || "";
    const evidence = finding.extractedText || "";
    const page = finding.pageNumber;

    // Card background
    ensureSpace(35);
    const cardStartY = y;

    // Calculate card height
    const detailLines = doc.splitTextToSize(detail, contentW - 30);
    const evidenceLines = evidence
      ? doc.splitTextToSize(`"${evidence}"`, contentW - 30)
      : [];
    const cardH = 18 + detailLines.length * 4 + (evidence ? 4 + evidenceLines.length * 4 + 6 : 0);

    ensureSpace(cardH + 4);

    // Left accent bar
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(margin, cardStartY, 3, cardH, "F");

    // Card background
    doc.setFillColor(248, 249, 250);
    doc.rect(margin + 3, cardStartY, contentW - 3, cardH, "F");

    // Status badge
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.roundedRect(margin + 8, cardStartY + 4, 22, 6, 1.5, 1.5, "F");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(status, margin + 19, cardStartY + 8.2, { align: "center" });

    // Check label
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 40, 50);
    doc.text(label, margin + 34, cardStartY + 8.2);

    // Page tag
    if (page) {
      const tagText = `p. ${page}`;
      const tagW = doc.getTextWidth(tagText) + 6;
      doc.setFillColor(230, 235, 240);
      doc.roundedRect(pageW - margin - tagW - 2, cardStartY + 4, tagW, 5, 1, 1, "F");
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 110, 120);
      doc.text(tagText, pageW - margin - tagW + 1, cardStartY + 7.8);
    }

    // Detail text
    let textY = cardStartY + 14;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 70, 80);
    doc.text(detailLines, margin + 8, textY);
    textY += detailLines.length * 4 + 2;

    // Evidence (underlined for REVIEW/FAIL)
    if (evidence) {
      doc.setFillColor(240, 242, 244);
      doc.rect(margin + 8, textY - 2, contentW - 16, evidenceLines.length * 4 + 4, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");

      if (status === "REVIEW" || status === "FAIL") {
        // Underline evidence for REVIEW/FAIL
        doc.setTextColor(color[0], color[1], color[2]);
        for (const line of evidenceLines) {
          doc.text(line, margin + 11, textY + 2);
          const lineW = doc.getTextWidth(line);
          doc.setDrawColor(color[0], color[1], color[2]);
          doc.setLineWidth(0.4);
          doc.line(margin + 11, textY + 3.2, margin + 11 + lineW, textY + 3.2);
          textY += 4;
        }
      } else {
        doc.setTextColor(80, 90, 100);
        doc.text(evidenceLines, margin + 11, textY + 2);
        textY += evidenceLines.length * 4;
      }
    }

    y = cardStartY + cardH + 4;
  };

  /* ================================================================
     PAGE 1 — HEADER BAR
     ================================================================ */
  doc.setFillColor(22, 22, 30);
  doc.rect(0, 0, pageW, 38, "F");

  // Brand
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("BG VALIDATOR", margin, 16);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 190, 200);
  doc.text("Automated Bank Guarantee Compliance Analysis", margin, 23);

  // Date & file
  doc.setTextColor(180, 190, 200);
  doc.setFontSize(7);
  doc.text(date, pageW - margin, 16, { align: "right" });
  doc.text(filename, pageW - margin, 23, { align: "right" });

  y = 48;

  /* ─── DOCUMENT INFO ─── */
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(25, 35, 50);
  doc.text("DOCUMENT INFORMATION", margin, y);
  y += 7;

  // Info grid
  const infoItems = [
    ["File", filename],
    ["Template", templateName],
    ["Type", result.documentType.toUpperCase()],
    ["Pages", String(result.pageCount)],
    ["Checks", String(result.findings.length)],
  ];

  const infoColW = contentW / 5;
  infoItems.forEach(([label, value], i) => {
    const ix = margin + i * infoColW;
    doc.setFillColor(245, 247, 249);
    doc.roundedRect(ix, y, infoColW - 2, 14, 2, 2, "F");
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 130, 140);
    doc.text(label.toUpperCase(), ix + 3, y + 5);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 40, 50);
    const valLines = doc.splitTextToSize(value, infoColW - 8);
    doc.text(valLines[0], ix + 3, y + 11);
  });
  y += 20;

  /* ─── USER INSTRUCTIONS + RESPONSES ─── */
  if (userInstructions && userInstructions.trim()) {
    drawSectionHeading("USER INSTRUCTIONS & RESPONSES");

    // Show original instructions
    doc.setFillColor(240, 243, 255);
    doc.roundedRect(margin, y, contentW, 10, 2, 2, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 99, 235);
    doc.text("INSTRUCTIONS PROVIDED:", margin + 4, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 60, 70);
    const instrLines = doc.splitTextToSize(userInstructions, contentW - 10);
    doc.text(instrLines, margin + 4, y + 8);
    y += 12 + instrLines.length * 3.5 + 4;

    // Generate and show per-instruction responses
    const responses = generateInstructionResponses(userInstructions, result.findings);

    for (const resp of responses) {
      ensureSpace(30);

      // Instruction header
      doc.setFillColor(248, 249, 250);
      doc.roundedRect(margin, y, contentW, 8, 1.5, 1.5, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 40, 50);
      const instrShort =
        resp.instruction.length > 100
          ? resp.instruction.substring(0, 100) + "..."
          : resp.instruction;
      doc.text(`"${instrShort}"`, margin + 4, y + 5.5);
      y += 12;

      // Response text
      const respLines = doc.splitTextToSize(resp.response, contentW - 10);

      // Determine response color based on content
      let respColor: [number, number, number] = [60, 70, 80];
      if (resp.response.includes("DISCREPANCIES")) respColor = STATUS_COLORS.FAIL;
      else if (resp.response.includes("REVIEW REQUIRED")) respColor = STATUS_COLORS.REVIEW;
      else if (resp.response.includes("PASSED")) respColor = STATUS_COLORS.PASS;

      doc.setFillColor(respColor[0], respColor[1], respColor[2]);
      doc.rect(margin, y - 1, 2, respLines.length * 4 + 4, "F");

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 60, 70);
      doc.text(respLines, margin + 6, y + 2);
      y += respLines.length * 4 + 8;

      // Show relevant findings briefly
      if (resp.relevantFindings.length > 0) {
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(120, 130, 140);
        doc.text(
          `${resp.relevantFindings.length} related finding(s) in validation results`,
          margin + 6,
          y,
        );
        y += 6;
      }
    }
    y += 4;
  }

  /* ─── OVERALL VERDICT ─── */
  const verdictColor =
    result.status === "VALID"
      ? STATUS_COLORS.PASS
      : result.status === "DISCREPANT"
        ? STATUS_COLORS.FAIL
        : STATUS_COLORS.REVIEW;

  // Use filtered counts if filtering is active
  const useFiltered = !!filteredFindings;
  const pCount = useFiltered ? reportPass : result.passCount;
  const rCount = useFiltered ? reportReview : result.reviewCount;
  const fCount = useFiltered ? reportFail : result.failCount;
  const iCount = useFiltered ? reportInfo : result.infoCount;

  const verdictLabel =
    result.status === "VALID"
      ? "VALIDATION PASSED"
      : result.status === "DISCREPANT"
        ? "DISCREPANCY DETECTED"
        : "REVIEW REQUIRED";

  const verdictDesc =
    result.status === "VALID"
      ? "No validation discrepancies were identified by the automated checks."
      : result.status === "DISCREPANT"
        ? "One or more checks require attention because a discrepancy was detected."
        : "The document requires manual verification for one or more uncertain checks.";

  ensureSpace(28);
  doc.setFillColor(verdictColor[0], verdictColor[1], verdictColor[2]);
  doc.roundedRect(margin, y, contentW, 20, 3, 3, "F");

  // Verdict icon circle
  doc.setFillColor(255, 255, 255);
  doc.circle(margin + 12, y + 10, 7, "F");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(verdictColor[0], verdictColor[1], verdictColor[2]);
  const icon = result.status === "VALID" ? "✓" : result.status === "DISCREPANT" ? "×" : "!";
  doc.text(icon, margin + 12, y + 13, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.text("VALIDATION RESULT", margin + 24, y + 6);
  doc.setFontSize(11);
  doc.text(verdictLabel, margin + 24, y + 12);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255, 200);
  doc.text(verdictDesc, margin + 24, y + 17);
  y += 28;

  /* ─── SUMMARY CARDS ─── */
  ensureSpace(26);
  const cardW = contentW / 4 - 2;
  const cards: { label: string; count: number; sub: string; color: [number, number, number]; bg: [number, number, number] }[] = [
    { label: "PASS", count: pCount, sub: "Requirements met", color: STATUS_COLORS.PASS, bg: STATUS_BG.PASS },
    { label: "REVIEW", count: rCount, sub: "Manual verification", color: STATUS_COLORS.REVIEW, bg: STATUS_BG.REVIEW },
    { label: "FAIL", count: fCount, sub: "Discrepancies found", color: STATUS_COLORS.FAIL, bg: STATUS_BG.FAIL },
    { label: "INFO", count: iCount, sub: "Additional findings", color: STATUS_COLORS.INFO, bg: STATUS_BG.INFO },
  ];

  cards.forEach((card, i) => {
    const cx = margin + i * (cardW + 3);
    doc.setFillColor(card.bg[0], card.bg[1], card.bg[2]);
    doc.roundedRect(cx, y, cardW, 20, 2, 2, "F");
    doc.setFillColor(card.color[0], card.color[1], card.color[2]);
    doc.rect(cx, y, cardW, 2, "F");
    doc.setTextColor(card.color[0], card.color[1], card.color[2]);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(String(card.count), cx + cardW / 2, y + 11, { align: "center" });
    doc.setTextColor(100, 110, 120);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(card.label, cx + cardW / 2, y + 15.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.text(card.sub, cx + cardW / 2, y + 18.5, { align: "center" });
  });
  y += 28;

  /* ─── ATTENTION REQUIRED ─── */
  const issueItems = reportFindings.filter((f) => f.status === "REVIEW" || f.status === "FAIL");

  if (issueItems.length > 0) {
    drawSectionHeading("ATTENTION REQUIRED");

    for (const item of issueItems) {
      ensureSpace(16);
      const color = STATUS_COLORS[item.status] || STATUS_COLORS.INFO;
      const bg = STATUS_BG[item.status] || STATUS_BG.INFO;

      // Row background
      doc.setFillColor(250, 250, 252);
      doc.roundedRect(margin, y, contentW, 12, 1.5, 1.5, "F");

      // Status badge
      doc.setFillColor(bg[0], bg[1], bg[2]);
      doc.roundedRect(margin + 4, y + 3, 18, 5.5, 1.5, 1.5, "F");
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(item.status, margin + 13, y + 6.8, { align: "center" });

      // Label
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 40, 50);
      doc.text(item.label, margin + 26, y + 6.8);

      // Detail (truncated)
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 110, 120);
      const detailTrunc =
        item.detail.length > 80 ? item.detail.substring(0, 80) + "..." : item.detail;
      doc.text(detailTrunc, margin + 26, y + 10.5);

      // Page
      if (item.pageNumber) {
        doc.setFontSize(6);
        doc.setTextColor(120, 130, 140);
        doc.text(`p. ${item.pageNumber}`, pageW - margin - 10, y + 6.8);
      }

      y += 14;
    }
    y += 4;
  }

  /* ─── DETAILED FINDINGS BY CATEGORY ─── */
  drawSectionHeading("VALIDATION RESULTS");

  CATEGORIES.forEach((cat) => {
    const catFindings = reportFindings.filter((f) => f.category === cat);
    if (catFindings.length === 0) return;

    ensureSpace(20);

    // Category sub-heading
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(25, 35, 50);
    doc.text(cat, margin, y);
    y += 3;

    // Category description
    const catDesc: Record<string, string> = {
      "Clause Validation": "Template clause presence and ordering checks",
      "Consistency Validation": "Cross-reference checks for amounts, dates, parties",
      "Logical Validation": "Logical consistency and legal requirement checks",
      "Document Validation": "Document quality and structure analysis",
      "Optional Information": "Supplementary bank-specific details detected",
    };
    if (catDesc[cat]) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(130, 140, 150);
      doc.text(catDesc[cat], margin, y + 4);
      y += 7;
    }

    // Draw each finding as a card
    for (const finding of catFindings) {
      drawCheckCard(finding);
    }
    y += 4;
  });

  /* ─── METHODOLOGY ─── */
  ensureSpace(30);
  doc.setFillColor(245, 247, 249);
  doc.roundedRect(margin, y, contentW, 22, 3, 3, "F");
  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 50, 60);
  doc.text("About this validation", margin + 6, y);
  y += 5;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 100, 110);
  const methText =
    "This report combines template-aware clause matching, OCR-tolerant text processing, " +
    "field extraction, consistency checks, date validation and document-level evidence analysis. " +
    "PASS = requirement confirmed. REVIEW = uncertainty or OCR variation detected. " +
    "FAIL = discrepancy detected. INFO = supplementary finding.";
  const methLines = doc.splitTextToSize(methText, contentW - 12);
  doc.text(methLines, margin + 6, y);
  y += methLines.length * 3.5 + 8;

  /* ─── FOOTER ─── */
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Footer line
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
    // Footer text
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 160, 170);
    doc.text("BG Validator Pro — Confidential", margin, pageH - 10);
    doc.text(
      `Generated ${date}  |  Page ${i} of ${totalPages}`,
      pageW - margin,
      pageH - 10,
      { align: "right" },
    );
  }

  /* ─── SAVE ─── */
  const safeName = filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`BG_Report_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
