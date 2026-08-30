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

const STATUS_COLORS: Record<string, [number, number, number]> = {
  PASS: [22, 163, 74],      // green
  REVIEW: [234, 179, 8],     // amber
  FAIL: [220, 38, 38],       // red
  INFO: [37, 99, 235],       // blue
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

export function generateReport(
  result: ValidationResult,
  filename: string,
  templateName: string,
  date: string,
  userInstructions?: string,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = 0;

  /* ─── Helper: new page if needed ─── */
  const ensureSpace = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
  };

  /* ─── Header bar ─── */
  doc.setFillColor(22, 22, 26);
  doc.rect(0, 0, pageW, 36, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("BG Validator Pro", margin, 16);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Validation Report", margin, 24);
  doc.text(date, pageW - margin, 24, { align: "right" });

  y = 50;

  /* ─── Document info ─── */
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DOCUMENT", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`File: ${filename}`, margin, y);
  y += 5;
  doc.text(`Template: ${templateName}`, margin, y);
  y += 5;
  doc.text(`Type: ${result.documentType}  |  Pages: ${result.pageCount}`, margin, y);
  y += 8;

  if (userInstructions) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("USER INSTRUCTIONS:", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(userInstructions, contentW);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 4;
  }
  y += 4;

  /* ─── Overall verdict ─── */
  const verdictColor =
    result.status === "VALID"
      ? STATUS_COLORS.PASS
      : result.status === "DISCREPANT"
        ? STATUS_COLORS.FAIL
        : STATUS_COLORS.REVIEW;

  const verdictLabel =
    result.status === "VALID"
      ? "VALID"
      : result.status === "DISCREPANT"
        ? "DISCREPANT"
        : "REVIEW REQUIRED";

  ensureSpace(30);
  doc.setFillColor(verdictColor[0], verdictColor[1], verdictColor[2]);
  doc.roundedRect(margin, y, contentW, 16, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Overall Verdict: ${verdictLabel}`, margin + 6, y + 10.5);
  y += 24;

  /* ─── Summary cards ─── */
  ensureSpace(26);
  const cardW = contentW / 4 - 2;
  const cards: { label: string; count: number; color: [number, number, number] }[] = [
    { label: "Pass", count: result.passCount, color: STATUS_COLORS.PASS },
    { label: "Review", count: result.reviewCount, color: STATUS_COLORS.REVIEW },
    { label: "Fail", count: result.failCount, color: STATUS_COLORS.FAIL },
    { label: "Info", count: result.infoCount, color: STATUS_COLORS.INFO },
  ];

  cards.forEach((card, i) => {
    const cx = margin + i * (cardW + 3);
    // bg
    const bgKey = card.label.toUpperCase() as keyof typeof STATUS_BG;
    const bg = STATUS_BG[bgKey];
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.roundedRect(cx, y, cardW, 20, 2, 2, "F");
    // colored top line
    doc.setFillColor(card.color[0], card.color[1], card.color[2]);
    doc.rect(cx, y, cardW, 2, "F");
    // count
    doc.setTextColor(card.color[0], card.color[1], card.color[2]);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(String(card.count), cx + cardW / 2, y + 12, { align: "center" });
    // label
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(card.label.toUpperCase(), cx + cardW / 2, y + 17, { align: "center" });
  });
  y += 30;

  /* ─── Detailed Findings by Category ─── */
  CATEGORIES.forEach((cat) => {
    const catFindings = result.findings.filter((f) => f.category === cat);
    if (catFindings.length === 0) return;

    ensureSpace(20);
    y += 4;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(cat.toUpperCase(), margin, y);
    y += 2;

    const bodyRows = catFindings.map((f) => {
      const statusCell = `[${f.status}]`;
      const pageCell = f.pageNumber ? `p. ${f.pageNumber}` : "—";
      const excerpt = f.extractedText
        ? `"${f.extractedText.substring(0, 80)}${f.extractedText.length > 80 ? "…" : ""}"`
        : "";
      return [statusCell, f.label, f.detail, pageCell, excerpt];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Status", "Check", "Detail", "Page", "Extracted Text"]],
      body: bodyRows,
      theme: "grid",
      styles: {
        fontSize: 7.5,
        cellPadding: 3,
        lineColor: [220, 220, 220],
        lineWidth: 0.3,
        textColor: [40, 40, 40],
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [60, 60, 60],
        fontStyle: "bold",
        fontSize: 7,
      },
      columnStyles: {
        0: { cellWidth: 20, halign: "center" },
        1: { cellWidth: 35 },
        2: { cellWidth: "auto" },
        3: { cellWidth: 15, halign: "center" },
        4: { cellWidth: 40 },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          const status = data.cell.raw?.toString().replace(/[\[\]]/g, "") || "";
          const color = STATUS_COLORS[status];
          if (color) {
            data.cell.styles.textColor = color;
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      didDrawPage: (_data) => {
        // footer on every page
        const h = doc.internal.pageSize.getHeight();
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.setFont("helvetica", "normal");
        doc.text("BG Validator Pro — Confidential", margin, h - 8);
        doc.text(
          `Page ${doc.getCurrentPageInfo().pageNumber}`,
          pageW - margin,
          h - 8,
          { align: "right" },
        );
      },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  });

  /* ─── Footer on first page ─── */
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    if (i === 1) {
      // already drawn by didDrawPage for body pages
    }
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text("BG Validator Pro — Confidential", margin, h - 8);
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin, h - 8, { align: "right" });
  }

  /* ─── Save ─── */
  const safeName = filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`BG_Report_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
