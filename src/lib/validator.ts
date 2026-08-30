import type {
  TemplateClause,
  ValidationFinding,
  FindingCategory,
  ValidationResult,
} from "./types";

/* ================================================================
   1. NORMALIZATION — exact notebook v_norm / v_match / compact
   ================================================================ */

function v_norm(text: string): string {
  let t = String(text || "");
  t = t.replace(/\xa0/g, " ");
  t = t.replace(/\u2018/g, "'").replace(/\u2019/g, "'");
  t = t.replace(/\u201c/g, '"').replace(/\u201d/g, '"');
  t = t.replace(/—/g, "-").replace(/–/g, "-");
  t = t.replace(/'/g, "'");
  t = t.replace(/\s+/g, " ");
  return t.trim();
}

function v_match(text: string): string {
  let t = v_norm(text).toLowerCase();
  t = t.replace(/&/g, " and ");
  t = t.replace(/\//g, " / ");
  t = t.replace(/[^a-z0-9₹.,:/\- ]+/g, " ");
  t = t.replace(/\s+/g, " ");
  return t.trim();
}

function compact(text: string): string {
  return v_match(text).replace(/[^a-z0-9]/g, "");
}

/* ================================================================
   2. FUZZY MATCHING — rapidfuzz-equivalent scoring
   ================================================================ */

/** token_set_ratio: compare sorted unique token sets */
function tokenSetRatio(a: string, b: string): number {
  const sa = new Set(a.split(" ").filter(Boolean));
  const sb = new Set(b.split(" ").filter(Boolean));
  if (sa.size === 0 && sb.size === 0) return 100;

  const inter = new Set([...sa].filter((w) => sb.has(w)));
  const sortedInter = [...inter].sort().join(" ");
  const sortedA = [...sa].sort().join(" ");
  const sortedB = [...sb].sort().join(" ");

  if (sortedInter === sortedA && sortedInter === sortedB) return 100;

  const diff_a = [...sa].filter((w) => !sb.has(w)).sort().join(" ");
  const diff_b = [...sb].filter((w) => !sa.has(w)).sort().join(" ");

  const set1 = sortedInter + (diff_a ? " " + diff_a : "");
  const set2 = sortedInter + (diff_b ? " " + diff_b : "");
  const set3 = diff_a || "";

  return Math.max(
    levenshteinRatio(sortedInter, set1),
    levenshteinRatio(sortedInter, set2),
    levenshteinRatio(set1, set2),
    levenshteinRatio(sortedInter, set3 || "x"),
  );
}

/** partial_ratio: best substring match (sliding window) */
function partialRatio(a: string, b: string): number {
  if (!a || !b) return 0;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length === 0) return 0;
  const words = longer.split(" ");
  const shortWords = shorter.split(" ");
  const window = Math.max(12, shortWords.length + 10);
  let best = 0;
  for (let i = 0; i < words.length; i += 4) {
    const chunk = words.slice(i, i + window).join(" ");
    const score = tokenSetRatio(shorter, chunk);
    if (score > best) best = score;
  }
  // Also try direct levenshtein on substrings
  const levScore = levenshteinRatio(shorter, longer);
  return Math.max(best, levScore);
}

/** Levenshtein-based ratio between two strings */
function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 100;
  if (a.length === 0 || b.length === 0) return 0;
  const al = a.length;
  const bl = b.length;
  const maxLen = Math.max(al, bl);
  // For long strings, use bigram similarity as approximation
  if (maxLen > 500) return bigramRatio(a, b);
  const dp: number[][] = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) dp[i][0] = i;
  for (let j = 0; j <= bl; j++) dp[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return ((maxLen - dp[al][bl]) / maxLen) * 100;
}

/** Bigram-based ratio for long strings */
function bigramRatio(a: string, b: string): number {
  const getBigrams = (s: string): Map<string, number> => {
    const map = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.substring(i, i + 2);
      map.set(bg, (map.get(bg) || 0) + 1);
    }
    return map;
  };
  const ba = getBigrams(a);
  const bb = getBigrams(b);
  let inter = 0;
  for (const [k, v] of ba) {
    const bv = bb.get(k) || 0;
    inter += Math.min(v, bv);
  }
  const totalA = [...ba.values()].reduce((s, v) => s + v, 0);
  const totalB = [...bb.values()].reduce((s, v) => s + v, 0);
  if (totalA === 0 || totalB === 0) return 0;
  return (2 * inter) / (totalA + totalB) * 100;
}

/* ================================================================
   3. PAGE HANDLING
   ================================================================ */

interface PageText {
  page: number;
  text: string;
}

function getPageTexts(
  pages: { pageNumber: number; text: string }[],
): PageText[] {
  return pages.map((p, i) => ({
    page: p.pageNumber || i + 1,
    text: v_norm(p.text),
  }));
}

/* ================================================================
   4. RESULT HELPER
   ================================================================ */

function addFinding(
  findings: ValidationFinding[],
  idx: { current: number },
  category: FindingCategory,
  checkId: string,
  label: string,
  status: ValidationFinding["status"],
  detail: string,
  pageNumber?: number,
  extractedText?: string,
  similarity?: number,
) {
  idx.current++;
  findings.push({
    id: `f_${idx.current}`,
    category,
    checkId,
    label,
    status,
    detail,
    pageNumber,
    extractedText,
  });
}

/* ================================================================
   5. CANONICAL CLAUSES & ANCHORS (from notebook)
   ================================================================ */

const CANONICAL_STARTS: [string, string][] = [
  ["C1", "We hereby undertake to give the irrevocable"],
  ["C2", "You will have the full liberty"],
  ["C3", "Your right to recover"],
  ["C4", "The guarantee herein contained"],
  ["C5", "The bank undertakes not to revoke"],
  ["C6", "Bank also agrees"],
  ["C7", "The amount under the Bank Guarantee"],
  ["C8", "Therefore, we hereby affirm"],
  ["C9", "We have power to issue this guarantee"],
  ["C10", "Notwithstanding anything contained herein"],
];

const CLAUSE_ANCHORS: Record<string, string[]> = {
  C1: [
    "we hereby undertake to give the irrevocable",
    "hereby undertake to give the irrevocable",
    "undertake to give the irrevocable",
  ],
  C2: ["you will have the full liberty", "will have the full liberty"],
  C3: ["your right to recover", "right to recover the said sum"],
  C4: [
    "the guarantee herein contained",
    "guarantee herein contained shall not be",
  ],
  C5: ["the bank undertakes not to revoke", "bank undertakes not to revoke"],
  C6: ["bank also agrees", "also agrees that gail"],
  C7: [
    "the amount under the bank guarantee",
    "amount under the bank guarantee",
  ],
  C8: [
    "therefore we hereby affirm",
    "therefore we hereby affirm that",
    "we hereby affirm that we are guarantors",
  ],
  C9: [
    "we have power to issue this guarantee",
    "have power to issue this guarantee",
    "power to issue this guarantee",
  ],
  C10: [
    "notwithstanding anything contained herein",
    "notwithstanding anything contained hereinabove",
  ],
};

/* ================================================================
   6. CLAUSE LOCATION — anchor-first matching (notebook cell 6)
   ================================================================ */

function findClauseLocation(
  clauseId: string,
  _clauseText: string,
  pages: PageText[],
): { score: number; page: number | null; evidence: string; anchor: string | null } {
  const anchors = CLAUSE_ANCHORS[clauseId] || [];
  let best = { score: 0, page: null as number | null, evidence: "", anchor: null as string | null };

  for (const p of pages) {
    const pageText = v_norm(p.text);
    const pageMatch = v_match(p.text);
    if (!pageMatch) continue;

    // A. Exact/near-exact anchor search
    for (const anchor of anchors) {
      const anchorM = v_match(anchor);
      const pos = pageMatch.indexOf(anchorM);
      if (pos >= 0) {
        const start = Math.max(0, pos - 120);
        const end = Math.min(pageText.length, pos + 700);
        const evidence = pageText.substring(start, end);
        const score = 98.0;
        if (score > best.score) {
          best = { score, page: p.page, evidence, anchor };
        }
      }
    }

    // B. Fuzzy anchor matching
    for (const anchor of anchors) {
      const anchorM = v_match(anchor);
      const words = pageMatch.split(" ");
      if (!words.length) continue;
      const anchorWords = anchorM.split(" ");
      const windowSize = Math.max(12, anchorWords.length + 10);

      for (let i = 0; i < words.length; i += 4) {
        const chunk = words.slice(i, i + windowSize).join(" ");
        if (!chunk) continue;
        const score = tokenSetRatio(anchorM, chunk);
        if (score > best.score) {
          best = { score: score, page: p.page, evidence: chunk, anchor };
        }
      }
    }
  }

  return best;
}

/* ================================================================
   7. CLAUSE VALIDATION — 3-tier scoring (notebook cell 7)
   ================================================================ */

function validateClause(
  definition: { id: string; title: string; text: string },
  pages: PageText[],
): { status: "PASS" | "REVIEW"; page: number | null; evidence: string; similarity: number; detail: string } {
  const match = findClauseLocation(definition.id, definition.text, pages);
  const { score, page, evidence } = match;

  if (score >= 96) {
    return {
      status: "PASS",
      page,
      evidence,
      similarity: score,
      detail: `Required clause detected with strong anchor evidence (${score.toFixed(1)}%).`,
    };
  }
  if (score >= 82) {
    return {
      status: "PASS",
      page,
      evidence,
      similarity: score,
      detail: `Clause appears present despite OCR/wording variation (${score.toFixed(1)}% confidence).`,
    };
  }
  if (score >= 60) {
    return {
      status: "REVIEW",
      page,
      evidence,
      similarity: score,
      detail: `Clause evidence was detected, but OCR or wording differs from the template (${score.toFixed(1)}% confidence). Manual verification is recommended.`,
    };
  }
  return {
    status: "REVIEW",
    page,
    evidence,
    similarity: score,
    detail: "Required clause could not be confidently matched. Manual verification is recommended.",
  };
}

/* ================================================================
   8. AMOUNT EXTRACTION & CONSISTENCY (notebook cell 8)
   ================================================================ */

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const SCALES: Record<string, number> = {
  hundred: 100, thousand: 1000, lakh: 100000, lakhs: 100000,
  crore: 10000000, crores: 10000000,
};

function wordsToNumber(text: string): number | null {
  let t = v_match(text);
  t = t.replace(/\b(?:rupees?|rs|inr|only|and|paise|paisa)\b/g, " ");
  const tokens = t.split(" ").filter(Boolean);
  if (!tokens.length) return null;

  let total = 0;
  let current = 0;
  let found = false;

  for (const token of tokens) {
    if (token in ONES) { current += ONES[token]; found = true; }
    else if (token in TENS) { current += TENS[token]; found = true; }
    else if (token === "hundred") { if (current === 0) current = 1; current *= 100; found = true; }
    else if (token in SCALES) {
      const scale = SCALES[token];
      if (current === 0) current = 1;
      total += current * scale;
      current = 0;
      found = true;
    }
  }
  if (!found) return null;
  return total + current;
}

function extractAmountFigures(text: string): number[] {
  const patterns = [
    /(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/gi,
    /(?:bg\s+amount|guarantee\s+amount|amount)\s*(?:is|of|:|-)?\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/gi,
  ];
  const values: number[] = [];
  for (const pattern of patterns) {
    let m;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(text)) !== null) {
      try {
        const value = parseFloat(m[1].replace(/,/g, ""));
        if (value >= 1000) values.push(value);
      } catch { /* skip */ }
    }
  }
  return [...new Map(values.map((v) => [v, v])).values()];
}

function extractAmountWords(text: string): number[] {
  const candidates: number[] = [];
  const patterns = [
    /(?:₹|rs\.?|inr)\s*[0-9][0-9,]*(?:\.\d+)?\s*(?:\/-|\/|-)?\s*\(\s*(?:rupees?)\s+([a-z\s-]{5,160})/gi,
    /\(\s*(?:rupees?)\s+([a-z\s-]{5,160})/gi,
  ];
  for (const pattern of patterns) {
    let m;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(text)) !== null) {
      let phrase = m[1];
      phrase = phrase.split(/\b(?:only|being|as\s+full|from\s+us|from\s+time|and\s+we|or\s+such)\b/)[0];
      const value = wordsToNumber(phrase);
      if (value !== null && value >= 1000) candidates.push(value);
    }
  }
  return [...new Map(candidates.map((v) => [v, v])).values()];
}

function checkAmountConsistency(text: string): ["PASS" | "REVIEW" | "FAIL", string] {
  const figures = extractAmountFigures(text);
  const words = extractAmountWords(text);

  if (!figures.length && !words.length) {
    return ["REVIEW", "No reliable guarantee amount could be identified."];
  }
  if (!figures.length) {
    return ["REVIEW", "Amount in words was detected, but a corresponding numeric amount could not be reliably identified."];
  }
  if (!words.length) {
    return ["REVIEW", "Numeric guarantee amount was detected, but a corresponding amount-in-words expression could not be reliably identified."];
  }

  const figureSet = new Set(figures.map((x) => Math.round(x * 100) / 100));
  const wordSet = new Set(words.map((x) => Math.round(x * 100) / 100));

  for (const v of figureSet) {
    if (wordSet.has(v)) {
      return ["PASS", `Amount in words and figures match: ₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`];
    }
  }

  // Dominant amount check
  const counter = new Map<number, number>();
  for (const v of figures) {
    const r = Math.round(v * 100) / 100;
    counter.set(r, (counter.get(r) || 0) + 1);
  }
  let dominant: number | null = null;
  let maxCount = 0;
  for (const [v, c] of counter) {
    if (c > maxCount) { maxCount = c; dominant = v; }
  }
  if (dominant !== null) {
    const closest = words.reduce((a, b) => Math.abs(b - dominant!) < Math.abs(a - dominant!) ? b : a);
    if (Math.abs(closest - dominant) <= 1) {
      return ["PASS", `Amount in words and figures match after normalization: ₹${dominant.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`];
    }
  }

  return [
    "FAIL",
    `Amount in words and figures do not match. Figures: ${figures.map((x) => "₹" + x.toLocaleString("en-IN", { minimumFractionDigits: 2 })).join(", ")} | Words: ${words.map((x) => "₹" + Math.round(x).toLocaleString("en-IN")).join(", ")}`,
  ];
}

/* ================================================================
   9. LABELED DATE EXTRACTION (notebook cell 9)
   ================================================================ */

function parseDateValue(value: string): Date | null {
  try {
    // Try DD/MM/YYYY or DD.MM.YYYY
    const parts = value.split(/[.\/-]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      let year = parseInt(parts[2]);
      if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
      if (year < 100) year += 2000;
      const d = new Date(year, month - 1, day);
      if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) return d;
    }
    // Try "DD Month YYYY"
    const altMatch = value.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/);
    if (altMatch) {
      const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
      const mi = months.indexOf(altMatch[2].toLowerCase());
      if (mi >= 0) {
        return new Date(parseInt(altMatch[3]), mi, parseInt(altMatch[1]));
      }
    }
  } catch { /* skip */ }
  return null;
}

function extractLabeledDates(text: string): { issue: Date[]; expiry: Date[]; claim_expiry: Date[] } {
  const result: { issue: Date[]; expiry: Date[]; claim_expiry: Date[] } = { issue: [], expiry: [], claim_expiry: [] };

  // Issue / execution date
  const issuePatterns = [
    /(?:date\s+of\s+issue|issue\s+date|issued\s+on|certificate\s+issue\s+date|dated)\D{0,80}(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/gi,
    /(?:date\s+of\s+issue|issue\s+date|issued\s+on|certificate\s+issue\s+date|dated)\D{0,80}(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/gi,
  ];
  for (const pattern of issuePatterns) {
    let m;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(text)) !== null) {
      const d = parseDateValue(m[1]);
      if (d) result.issue.push(d);
    }
  }

  // Claim expiry (check BEFORE general expiry)
  const claimPatterns = [
    /(?:bg\s+claim\s+expiry\s+date|claim\s+expiry\s+date|claim\s+expiry|claim\s+period)\D{0,100}(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/gi,
    /(?:bg\s+claim\s+expiry\s+date|claim\s+expiry\s+date|claim\s+expiry|claim\s+period)\D{0,100}(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/gi,
  ];
  for (const pattern of claimPatterns) {
    let m;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(text)) !== null) {
      const d = parseDateValue(m[1]);
      if (d) result.claim_expiry.push(d);
    }
  }

  // General BG expiry
  const expiryPatterns = [
    /(?:bg\s+expiry\s+date|expiry\s+date|guarantee\s+expiry|valid\s+up\s+to|valid\s+till|valid\s+until)\D{0,100}(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/gi,
    /(?:bg\s+expiry\s+date|expiry\s+date|guarantee\s+expiry|valid\s+up\s+to|valid\s+till|valid\s+until)\D{0,100}(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/gi,
  ];
  for (const pattern of expiryPatterns) {
    let m;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(text)) !== null) {
      const d = parseDateValue(m[1]);
      if (d) result.expiry.push(d);
    }
  }

  // Deduplicate
  for (const key of ["issue", "expiry", "claim_expiry"] as const) {
    result[key] = [...new Map(result[key].map((d) => [d.getTime(), d])).values()];
  }

  return result;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function checkDateLogic(text: string): ["PASS" | "REVIEW" | "FAIL", string] {
  const dates = extractLabeledDates(text);
  const issue = dates.issue[0] || null;
  const expiry = dates.expiry[0] || null;
  const claim = dates.claim_expiry[0] || null;

  if (expiry && claim) {
    if (claim < expiry) {
      return ["FAIL", `Claim-expiry date ${claim.toISOString().slice(0, 10)} occurs before BG expiry date ${expiry.toISOString().slice(0, 10)}.`];
    }
    const required = addMonths(expiry, 3);
    if (claim >= required) {
      if (issue && issue > expiry) {
        return ["FAIL", `Issue date ${issue.toISOString().slice(0, 10)} occurs after expiry date ${expiry.toISOString().slice(0, 10)}.`];
      }
      return ["PASS", `Expiry=${expiry.toISOString().slice(0, 10)} | Claim=${claim.toISOString().slice(0, 10)} | Claim period ≥ 3 months.`];
    }
    return [`FAIL`, `Claim expiry ${claim.toISOString().slice(0, 10)} is less than 3 months after BG expiry ${expiry.toISOString().slice(0, 10)}. Required at least ${required.toISOString().slice(0, 10)}.`];
  }

  if (expiry && !claim) {
    if (issue && issue > expiry) {
      return ["FAIL", `Issue date ${issue.toISOString().slice(0, 10)} occurs after expiry date ${expiry.toISOString().slice(0, 10)}.`];
    }
    return ["REVIEW", `BG expiry date detected as ${expiry.toISOString().slice(0, 10)}, but a clearly labeled claim-expiry date could not be reliably identified.`];
  }

  return ["REVIEW", "No sufficiently reliable labeled BG expiry/claim date relationship could be established."];
}

/* ================================================================
   10. BG NUMBER (notebook cell 10)
   ================================================================ */

function extractBgNumbers(text: string): string[] {
  const pattern = /(?:bank\s+guarantee|bg)\s*(?:no\.?|number)\s*[:.\-]?\s*([A-Z0-9][A-Z0-9./\-]{4,})/gi;
  const values: string[] = [];
  let m;
  while ((m = pattern.exec(text)) !== null) {
    const val = v_norm(m[1]).toUpperCase();
    if (val.length >= 6) values.push(val);
  }
  return [...new Set(values)];
}

function checkBgNumber(text: string): ["PASS" | "REVIEW" | "FAIL", string] {
  const values = extractBgNumbers(text);
  if (!values.length) return ["REVIEW", "No reliable Bank Guarantee number was detected."];
  if (values.length === 1) return ["PASS", `BG number is consistent: ${values[0]}`];

  const compactValues = values.map(compact);
  for (let i = 0; i < compactValues.length; i++) {
    for (let j = 0; j < compactValues.length; j++) {
      if (i !== j && (compactValues[i].includes(compactValues[j]) || compactValues[j].includes(compactValues[i]))) {
        return ["REVIEW", "Multiple closely related BG-number readings were detected; verify visually."];
      }
    }
  }
  return ["FAIL", "Multiple different BG numbers detected: " + values.join(", ")];
}

/* ================================================================
   11. CONTRACT / PO / FOA / LOA (notebook cell 11)
   ================================================================ */

function extractReferences(text: string): string[] {
  const pattern = /(?:FOA|LOA|PO|P\.O\.|purchase\s+order|contract)\s*(?:no\.?|number)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9./&\-]{6,})/gi;
  const values: string[] = [];
  const blacklist = new Set(["conditions", "performance", "responsibility", "responsible", "stpone", "stponement", "rated", "nsibility"]);

  let m;
  while ((m = pattern.exec(text)) !== null) {
    const val = v_norm(m[1]).toUpperCase();
    if (val.length < 7) continue;
    if (blacklist.has(val.toLowerCase())) continue;
    if (!/\d/.test(val)) continue;
    values.push(val);
  }
  return [...new Set(values)];
}

function checkReference(text: string): ["PASS" | "REVIEW", string] {
  const values = extractReferences(text);
  if (!values.length) return ["REVIEW", "No reliable PO / LOA / FOA / contract reference was detected."];
  if (values.length === 1) return ["PASS", `Contract / purchase-order reference detected: ${values[0]}`];

  const compactValues = values.map(compact);
  for (let i = 0; i < compactValues.length; i++) {
    for (let j = i + 1; j < compactValues.length; j++) {
      if (compactValues[i].includes(compactValues[j]) || compactValues[j].includes(compactValues[i])) {
        return ["REVIEW", "Related contract/reference readings were detected. Manual verification recommended."];
      }
    }
  }
  return ["REVIEW", "Multiple contract/reference values were detected: " + values.join(", ")];
}

/* ================================================================
   12. BENEFICIARY (notebook cell 12)
   ================================================================ */

function extractExpectedBeneficiary(templateText: string): string | null {
  const patterns = [
    /(?:in\s+favour\s+of|in\s+favor\s+of|beneficiary)\s*[:\-]?\s*([A-Z][A-Za-z0-9&.,()\- ]{3,100})/gi,
  ];
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(templateText)) !== null) {
      let value = v_norm(m[1]);
      value = value.split(/\b(?:hereinafter|having|through|which|under|for\s+the)\b/)[0].trim();
      if (value.split(" ").length >= 2) return value;
    }
  }
  const fallback = templateText.match(/(gail\s*\(?india\)?\s+limited)/i);
  if (fallback) return v_norm(fallback[1]);
  return null;
}

function checkBeneficiary(templateText: string, text: string): ["PASS" | "REVIEW" | "FAIL", string] {
  const expected = extractExpectedBeneficiary(templateText);
  if (!expected) return ["PASS", "No specific beneficiary identity could be reliably extracted from the template."];

  const expectedM = v_match(expected);
  const textM = v_match(text);
  const score = partialRatio(expectedM, textM);

  if (score >= 90) return ["PASS", `Beneficiary matches template: ${expected}`];
  if (score >= 70) return ["REVIEW", `Beneficiary appears consistent with template (${score.toFixed(1)}% confidence): ${expected}`];
  return ["FAIL", `Expected beneficiary '${expected}' was not reliably confirmed in the BG.`];
}

/* ================================================================
   13. SIGNATURE / AUTHORIZATION (notebook cell 13)
   ================================================================ */

function checkSignature(text: string): ["PASS" | "REVIEW", string, string] {
  const patterns = [
    /\bauthori[sz]ed\s+signatory\b/i,
    /\bauthori[sz]ed\s+signature\b/i,
    /\bauthori[sz]ed\s+signing\b/i,
    /\bsignature\s+of\b/i,
    /\bsignature\b/i,
    /\bsigned\b/i,
    /\bdigitally\s+signed\b/i,
    /\bpower\s+of\s+attorney\b/i,
    /\bfor\s+and\s+on\s+behalf\s+of\b/i,
    /\bbranch\s+manager\b/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m && m.index !== undefined) {
      const start = Math.max(0, m.index - 100);
      const end = Math.min(text.length, m.index + m[0].length + 180);
      return ["PASS", "Signature / authorization evidence detected.", text.substring(start, end)];
    }
  }
  return ["REVIEW", "No reliable textual signature/authorization evidence was detected. Visual verification may be required.", ""];
}

/* ================================================================
   14. STAMP / E-STAMP (notebook cell 14)
   ================================================================ */

function templateRequiresStamp(templateText: string): boolean {
  return /\b(?:stamp|e-?stamp|non[- ]?judicial|stamp\s+paper)\b/i.test(templateText);
}

function checkStamp(text: string, templateText: string): ["PASS" | "REVIEW", string, string] {
  if (!templateRequiresStamp(templateText)) {
    return ["PASS", "Stamp/e-stamp is not identified as a mandatory requirement in the uploaded template.", ""];
  }
  const pattern = /\b(?:e-?stamp|stamp\s+duty|non[- ]?judicial|certificate\s+no|serial\s+no|IN-[A-Z0-9]{6,})\b/i;
  const m = text.match(pattern);
  if (m && m.index !== undefined) {
    const start = Math.max(0, m.index - 100);
    const end = Math.min(text.length, m.index + m[0].length + 200);
    return ["PASS", "Required stamp/e-stamp evidence detected.", text.substring(start, end)];
  }
  return ["REVIEW", "The template refers to stamp requirements, but reliable textual stamp/e-stamp evidence was not detected. Visually verify the BG.", ""];
}

/* ================================================================
   15. CONCEPT CHECKS (notebook cell 15)
   ================================================================ */

interface ConceptCheck {
  id: string;
  label: string;
  patterns: RegExp[];
}

const CONCEPT_CHECKS: ConceptCheck[] = [
  { id: "irrevocable", label: "Irrevocable guarantee", patterns: [/\birrevocable\b/i] },
  { id: "unconditional", label: "Unconditional guarantee", patterns: [/\bunconditional\b/i] },
  { id: "first_demand", label: "First demand", patterns: [/\bfirst\s+(?:written\s+)?demand\b/i] },
  { id: "principal_debtor", label: "Principal debtor", patterns: [/\bprincipal\s+debtor\b/i] },
  { id: "forthwith", label: "Without delay / forthwith payment", patterns: [/\bforthwith\b/i, /\bwithout\s+any\s+delay\b/i] },
  { id: "new_delhi", label: "Exclusive New Delhi jurisdiction", patterns: [/exclusive\s+jurisdiction.*new\s+delhi/i, /new\s+delhi.*exclusive\s+jurisdiction/i] },
];

function checkConcepts(text: string): { id: string; label: string; status: "PASS" | "REVIEW"; detail: string; evidence: string }[] {
  const results: { id: string; label: string; status: "PASS" | "REVIEW"; detail: string; evidence: string }[] = [];
  for (const check of CONCEPT_CHECKS) {
    let matched: RegExpMatchArray | null = null;
    for (const pattern of check.patterns) {
      const m = text.match(pattern);
      if (m) { matched = m; break; }
    }
    if (matched && matched.index !== undefined) {
      const start = Math.max(0, matched.index - 100);
      const end = Math.min(text.length, matched.index + matched[0].length + 180);
      results.push({
        id: check.id,
        label: check.label,
        status: "PASS",
        detail: `Required concept detected: ${check.label}.`,
        evidence: text.substring(start, end),
      });
    } else {
      results.push({
        id: check.id,
        label: check.label,
        status: "REVIEW",
        detail: `Required concept '${check.label}' was not reliably detected. OCR/manual verification recommended.`,
        evidence: "",
      });
    }
  }
  return results;
}

/* ================================================================
   16. CLAUSE ORDER (notebook cell 16)
   ================================================================ */

function checkClauseOrder(
  clauseDefinitions: { id: string }[],
  fullText: string,
): ["PASS" | "REVIEW", string] {
  const positions: [number, number][] = [];
  const textM = v_match(fullText);

  for (let idx = 0; idx < clauseDefinitions.length; idx++) {
    const cid = clauseDefinitions[idx].id;
    const anchors = CLAUSE_ANCHORS[cid] || [];
    for (const anchor of anchors) {
      const pos = textM.indexOf(v_match(anchor));
      if (pos >= 0) {
        positions.push([idx, pos]);
        break;
      }
    }
  }

  if (positions.length < 4) {
    return ["PASS", "Not enough reliable clause anchors were available to establish an order discrepancy."];
  }
  const actual = positions.map(([, pos]) => pos);
  if (actual.every((v, i) => i === 0 || v >= actual[i - 1])) {
    return ["PASS", "Reliably detected template clauses appear in the expected sequence."];
  }
  return ["REVIEW", "Some clause anchors were detected out of perfect sequence. This may be caused by OCR or document layout."];
}

/* ================================================================
   17. NUMBERING (notebook cell 17)
   ================================================================ */

function checkNumbering(text: string): ["PASS" | "REVIEW", string] {
  const matches = text.match(/(?:^|[\n ])(\d{1,2})[.)]\s+/g) || [];
  const nums: number[] = [];
  for (const m of matches) {
    const n = parseInt(m.replace(/[^0-9]/g, ""));
    if (!isNaN(n) && n >= 1 && n <= 20) nums.push(n);
  }
  if (nums.length < 4) {
    return ["PASS", "No reliable clause-numbering contradiction was established."];
  }
  const seen: number[] = [];
  for (const n of nums) {
    if (!seen.includes(n)) seen.push(n);
  }
  if (seen.length >= 4) {
    const expected = Array.from({ length: Math.max(...seen) - Math.min(...seen) + 1 }, (_, i) => i + Math.min(...seen));
    const missing = expected.filter((n) => !seen.includes(n));
    if (missing.length > 0 && missing.length <= 2) {
      return ["REVIEW", "Possible missing clause numbering: " + missing.join(", ") + ". OCR/layout verification recommended."];
    }
  }
  return ["PASS", "No reliable clause-numbering contradiction was established."];
}

/* ================================================================
   18. REPETITION (notebook cell 18)
   ================================================================ */

function checkRepetition(pages: PageText[]): ["PASS" | "REVIEW", string] {
  const normalized = pages.map((p) => {
    const text = v_match(p.text);
    const sentences = text.split(/(?<=[.!?])\s+/);
    return sentences.filter((s) => s.split(" ").length >= 18);
  });

  const repeats: [number, number, string][] = [];
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      for (const block of normalized[i]) {
        for (const other of normalized[j]) {
          const score = levenshteinRatio(block, other);
          if (score >= 97) {
            repeats.push([i + 1, j + 1, block]);
          }
        }
      }
    }
  }

  if (!repeats.length) {
    return ["PASS", "No unnecessary repeated paragraph/table-like block was detected."];
  }

  const pairs = [...new Map(repeats.map(([a, b]) => [`${a}-${b}`, [a, b]])).values()];
  return [
    "REVIEW",
    "Substantial repeated content was detected across " +
      pairs.slice(0, 5).map(([a, b]) => `pages ${a}-${b}`).join(", ") +
      ". Verify whether the repetition is structurally required.",
  ];
}

/* ================================================================
   19. PAGE LOCALIZATION (notebook cell 19)
   ================================================================ */

function locateEvidencePage(evidence: string, pages: PageText[]): number | null {
  if (!evidence) return null;
  const evidenceM = v_match(evidence);
  if (!evidenceM) return null;

  let bestPage: number | null = null;
  let bestScore = 0;

  for (const p of pages) {
    const pageM = v_match(p.text);
    if (!pageM) continue;
    if (pageM.includes(evidenceM.substring(0, 100))) return p.page;

    const score = partialRatio(evidenceM.substring(0, 300), pageM);
    if (score > bestScore) {
      bestScore = score;
      bestPage = p.page;
    }
  }
  return bestPage;
}

/* ================================================================
   20. OPTIONAL INFO DETECTION (INFO findings only)
   ================================================================ */

function checkOptionalInfo(
  text: string,
  pages: PageText[],
  findings: ValidationFinding[],
  idx: { current: number },
) {
  // IFSC
  const ifsc = text.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/);
  if (ifsc) {
    addFinding(findings, idx, "Optional Information", "ifsc", "IFSC Code", "INFO",
      `IFSC code detected: ${ifsc[1]}. This is additional bank-specific information.`, undefined, ifsc[1]);
  }

  // SWIFT/BIC
  const swift = text.match(/\b([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/);
  if (swift) {
    const exclusions = ["ACCOUNT", "ADDRESS", "COMPANY", "GUARANTEE", "BENEFICIARY", "APPLICANT", "BANKING", "CHARGES", "CUSTOMER", "DETAILS", "DOCUMENT", "FINANCE", "GUARANTEE", "INDICATE", "ISSUANCE", "LETTERS", "MENTION", "NOMINAL", "ORIGINAL", "PAYMENT", "REQUIRE", "SECTION", "TARIFF", "UNIQUE", "VARIANCE"];
    if (!exclusions.includes(swift[1])) {
      addFinding(findings, idx, "Optional Information", "swift", "SWIFT / BIC Code", "INFO",
        `SWIFT/BIC code detected: ${swift[1]}. This is additional bank-specific information.`, undefined, swift[1]);
    }
  }

  // Branch
  const branch = text.match(/branch\s*[:.]?\s*(.+?)(?:\n|$)/i);
  if (branch) {
    addFinding(findings, idx, "Optional Information", "branch", "Branch Information", "INFO",
      `Branch information detected: ${branch[1].trim().substring(0, 100)}`, undefined, branch[1].trim().substring(0, 100));
  }

  // Email
  const email = text.match(/[\w.-]+@[\w.-]+\.[A-Za-z]{2,}/);
  if (email) {
    addFinding(findings, idx, "Optional Information", "email", "Email Contact", "INFO",
      `Email address detected: ${email[0]}`, undefined, email[0]);
  }

  // Phone
  const phone = text.match(/(?:\+91[\s-]?)?0?\d{10}\b/);
  if (phone) {
    addFinding(findings, idx, "Optional Information", "phone", "Phone Contact", "INFO",
      `Phone number detected: ${phone[0]}`, undefined, phone[0]);
  }

  // GST
  const gst = text.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]\b/);
  if (gst) {
    addFinding(findings, idx, "Optional Information", "gst", "GST Number", "INFO",
      `GST number detected: ${gst[0]}`, undefined, gst[0]);
  }

  // PAN
  const pan = text.match(/\b[A-Z]{5}\d{4}[A-Z]\b/);
  if (pan) {
    addFinding(findings, idx, "Optional Information", "pan", "PAN Number", "INFO",
      `PAN number detected: ${pan[0]}`, undefined, pan[0]);
  }

  // Address
  const address = text.match(/(?:address|registered\s+office|corporate\s+office|branch\s+office)\s*[:.]?\s*(.+?)(?:\n|$)/gi);
  if (address && address[0]) {
    const addr = v_norm(address[0].replace(/^[^:]+:?\s*/, ""));
    if (addr.length > 10) {
      addFinding(findings, idx, "Optional Information", "address", "Address Information", "INFO",
        `Address detected in the document: "${addr.substring(0, 120)}${addr.length > 120 ? "…" : ""}"`,
        undefined, addr.substring(0, 120));
    }
  }
}

/* ================================================================
   21. DOCUMENT QUALITY CHECKS
   ================================================================ */

function checkDocumentQuality(
  text: string,
  pages: { pageNumber: number; text: string; isScanned?: boolean; confidence?: number }[],
  findings: ValidationFinding[],
  idx: { current: number },
) {
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  const charCount = text.replace(/\s/g, "").length;

  if (wordCount < 30 || charCount < 100) {
    addFinding(findings, idx, "Document Validation", "low_text_quality", "Document Text Quality", "FAIL",
      `Only ${wordCount} words (${charCount} characters) extracted. The document may be corrupted, empty, or require better OCR processing.`);
  } else if (wordCount < 100) {
    addFinding(findings, idx, "Document Validation", "low_text_quality", "Document Text Quality", "REVIEW",
      `Only ${wordCount} words extracted. Some content may be missing or difficult to extract. Check the extracted text for completeness.`);
  } else {
    addFinding(findings, idx, "Document Validation", "low_text_quality", "Document Text Quality", "PASS",
      `Document contains ${wordCount} words. Text extraction appears successful.`);
  }

  // Scanned page quality
  const scannedPages = pages.filter((p) => p.isScanned === true);
  if (scannedPages.length > 0) {
    addFinding(findings, idx, "Document Validation", "scanned_pages", "Scanned Pages Detected", "INFO",
      `${scannedPages.length} of ${pages.length} page(s) were detected as scanned and processed via OCR.`);
    for (const page of scannedPages) {
      if (page.confidence != null && page.confidence < 0.5) {
        addFinding(findings, idx, "Document Validation", `page_quality_${page.pageNumber}`, `Page ${page.pageNumber} — Low OCR Confidence`, "REVIEW",
          `Page ${page.pageNumber} had low OCR confidence (${Math.round(page.confidence * 100)}%). The extracted text on this page may contain errors.`, page.pageNumber);
      }
    }
  }

  // Garbled text
  const garbled = text.match(/[^\x00-\x7F]{5,}/g);
  if (garbled && garbled.length > 3) {
    addFinding(findings, idx, "Document Validation", "garbled_text", "Garbled Text Detected", "REVIEW",
      `${garbled.length} garbled text sequences found. These may be OCR artifacts or encoding issues from scanned documents.`);
  }

  // Structure check
  const bgLower = text.toLowerCase();
  const hasTitle = bgLower.includes("bank guarantee") || bgLower.includes("guarantee");
  const hasParties = bgLower.includes("beneficiary") || bgLower.includes("applicant") || bgLower.includes("principal");
  const hasAmount = extractAmountFigures(text).length > 0;
  const hasDates = extractLabeledDates(text).issue.length + extractLabeledDates(text).expiry.length > 0;
  const hasTerms = bgLower.includes("terms and conditions") || bgLower.includes("conditions") || bgLower.includes("terms of");
  const elements = [hasTitle && "title", hasParties && "parties", hasAmount && "amount", hasDates && "dates", hasTerms && "terms"].filter(Boolean);
  const score = elements.length / 5;

  if (score >= 0.8) {
    addFinding(findings, idx, "Document Validation", "structure_check", "Document Structure", "PASS",
      `Document structure appears complete (${elements.join(", ")}).`);
  } else if (score >= 0.4) {
    addFinding(findings, idx, "Document Validation", "structure_check", "Document Structure", "REVIEW",
      `Only ${elements.length} of 5 key structural elements detected (${elements.join(", ")}). Some elements may be missing.`);
  } else {
    addFinding(findings, idx, "Document Validation", "structure_check", "Document Structure", "FAIL",
      `Only ${elements.length} of 5 key structural elements found. The document may not be a valid Bank Guarantee.`);
  }
}

/* ================================================================
   MAIN VALIDATION ENGINE — exact notebook validate_document()
   ================================================================ */

export function validateBg(
  templateClauses: TemplateClause[],
  templateText: string,
  bgText: string,
  bgPages: { pageNumber: number; text: string; isScanned?: boolean; confidence?: number }[],
  userInstructions?: string,
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const idx = { current: 0 };

  const pages = getPageTexts(bgPages);
  const fullText = pages.map((p) => p.text).join("\n");

  // Build clause definitions from template (notebook cell 4)
  const clauseDefinitions = CANONICAL_STARTS.map(([cid, title]) => {
    // Try to find matching clause from uploaded template
    let text = title;
    for (const clause of templateClauses) {
      const cId = String(clause.id || "").toUpperCase();
      const cTitle = v_norm(clause.label || "");
      const cText = v_norm(clause.content || "");
      if (cId === cid || cTitle.includes(title.toLowerCase())) {
        if (cText) text = cText;
      }
    }
    return { id: cid, title, text };
  });

  /* ── C1-C10: CLAUSE VALIDATION ── */
  for (const definition of clauseDefinitions) {
    const result = validateClause(definition, pages);
    addFinding(findings, idx, "Clause Validation", definition.id, definition.title,
      result.status, result.detail, result.page ?? undefined, result.evidence || undefined, result.similarity);
  }

  /* ── AMOUNT CONSISTENCY ── */
  const [amtStatus, amtDetail] = checkAmountConsistency(fullText);
  addFinding(findings, idx, "Consistency Validation", "amount_consistency", "Amount in words and figures",
    amtStatus, amtDetail);

  /* ── BG NUMBER ── */
  const [bgStatus, bgDetail] = checkBgNumber(fullText);
  const bgNumbers = extractBgNumbers(fullText);
  addFinding(findings, idx, "Consistency Validation", "bg_number", "BG number consistency",
    bgStatus, bgDetail, undefined, bgNumbers[0] || "");

  /* ── CONTRACT REFERENCE ── */
  const [refStatus, refDetail] = checkReference(fullText);
  const references = extractReferences(fullText);
  addFinding(findings, idx, "Consistency Validation", "contract_reference", "Contract / purchase-order reference",
    refStatus, refDetail, undefined, references.slice(0, 3).join(", "));

  /* ── DATE LOGIC ── */
  const [dateStatus, dateDetail] = checkDateLogic(fullText);
  const labeledDates = extractLabeledDates(fullText);
  const evidenceParts: string[] = [];
  if (labeledDates.expiry.length) evidenceParts.push(`Expiry=${labeledDates.expiry[0].toISOString().slice(0, 10)}`);
  if (labeledDates.claim_expiry.length) evidenceParts.push(`Claim=${labeledDates.claim_expiry[0].toISOString().slice(0, 10)}`);
  addFinding(findings, idx, "Logical Validation", "date_logic", "Date / claim-period consistency",
    dateStatus, dateDetail, undefined, evidenceParts.join(" | "));

  /* ── BENEFICIARY ── */
  const [benStatus, benDetail] = checkBeneficiary(templateText, fullText);
  addFinding(findings, idx, "Consistency Validation", "beneficiary", "Beneficiary consistency",
    benStatus, benDetail);

  /* ── SIGNATURE ── */
  const [sigStatus, sigDetail, sigEvidence] = checkSignature(fullText);
  const sigPage = locateEvidencePage(sigEvidence, pages);
  addFinding(findings, idx, "Logical Validation", "signature", "Signature / authorization",
    sigStatus, sigDetail, sigPage ?? undefined, sigEvidence || undefined);

  /* ── STAMP ── */
  const [stampStatus, stampDetail, stampEvidence] = checkStamp(fullText, templateText);
  const stampPage = locateEvidencePage(stampEvidence, pages);
  addFinding(findings, idx, "Logical Validation", "stamp", "Stamp / e-Stamp evidence",
    stampStatus, stampDetail, stampPage ?? undefined, stampEvidence || undefined);

  /* ── CONCEPT CHECKS ── */
  const conceptResults = checkConcepts(fullText);
  for (const item of conceptResults) {
    const page = locateEvidencePage(item.evidence, pages);
    const category: FindingCategory = "Logical Validation";
    addFinding(findings, idx, category, item.id, item.label,
      item.status, item.detail, page ?? undefined, item.evidence || undefined);
  }

  /* ── CLAUSE ORDER ── */
  const [orderStatus, orderDetail] = checkClauseOrder(clauseDefinitions, fullText);
  addFinding(findings, idx, "Clause Validation", "clause_order", "Paragraph / clause order",
    orderStatus, orderDetail);

  /* ── NUMBERING ── */
  const [numStatus, numDetail] = checkNumbering(fullText);
  addFinding(findings, idx, "Clause Validation", "numbering", "Paragraph numbering",
    numStatus, numDetail);

  /* ── REPETITION ── */
  const [repStatus, repDetail] = checkRepetition(pages);
  addFinding(findings, idx, "Document Validation", "repetition", "Repeated paragraph / table content",
    repStatus, repDetail);

  /* ── DOCUMENT QUALITY ── */
  checkDocumentQuality(fullText, bgPages, findings, idx);

  /* ── OPTIONAL INFO (INFO findings) ── */
  checkOptionalInfo(fullText, pages, findings, idx);

  /* ── PAGE-LEVEL EVIDENCE LOCALIZATION ── */
  for (const finding of findings) {
    if (finding.pageNumber == null && finding.extractedText) {
      const page = locateEvidencePage(finding.extractedText, pages);
      if (page != null) finding.pageNumber = page;
    }
  }

  /* ── USER INSTRUCTIONS ── */
  if (userInstructions && userInstructions.trim()) {
    addFinding(findings, idx, "Logical Validation", "user_instructions", "User Instructions Provided",
      "INFO", `Additional validation instructions were provided: "${userInstructions.trim()}"`);
  }

  return findings;
}

/* ================================================================
   COMPUTE OVERALL RESULT
   ================================================================ */

export function computeResult(
  findings: ValidationFinding[],
  documentType: string,
  pageCount: number,
  extractedText: string,
): ValidationResult {
  const passCount = findings.filter((f) => f.status === "PASS").length;
  const reviewCount = findings.filter((f) => f.status === "REVIEW").length;
  const failCount = findings.filter((f) => f.status === "FAIL").length;
  const infoCount = findings.filter((f) => f.status === "INFO").length;

  let status: "VALID" | "REVIEW" | "DISCREPANT" = "VALID";
  if (failCount > 0) status = "DISCREPANT";
  else if (reviewCount > 0) status = "REVIEW";

  return {
    documentType: documentType as any,
    pageCount,
    status,
    passCount,
    reviewCount,
    failCount,
    infoCount,
    findings,
    extractedText,
  };
}
