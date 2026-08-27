import type {
  TemplateClause,
  ValidationFinding,
  FindingCategory,
  ValidationResult,
} from "./types";

/* ──────────────────────────────────────────────────────────────
   HELPERS
   ────────────────────────────────────────────────────────────── */

/** Normalize text for comparison: lowercase, collapse whitespace, strip punctuation */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bigram-based similarity ratio (0–1). */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;

  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.substring(i, i + 2));
    return set;
  };
  const ba = bigrams(na);
  const bb = bigrams(nb);
  let intersection = 0;
  for (const b of ba) {
    if (bb.has(b)) intersection++;
  }
  return (2 * intersection) / (ba.size + bb.size);
}

/** Fuzzy word overlap ratio between two strings */
function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(normalize(b).split(" ").filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  return intersection / Math.min(wordsA.size, wordsB.size);
}

/** Find first regex match group */
function extractField(text: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

/** Check if a phrase/word exists in text (case-insensitive) */
function hasPhrase(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

/** Find all regex matches */
function findAllMatches(text: string, pattern: RegExp): string[] {
  const matches: string[] = [];
  let m;
  while ((m = pattern.exec(text)) !== null) {
    if (m[1]) matches.push(m[1].trim());
  }
  return matches;
}

/* ──────────────────────────────────────────────────────────────
   MAIN VALIDATION ENGINE
   ────────────────────────────────────────────────────────────── */

export function validateBg(
  templateClauses: TemplateClause[],
  templateText: string,
  bgText: string,
  bgPages: { pageNumber: number; text: string; isScanned?: boolean; confidence?: number }[]
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  let findingIdx = 0;

  const addFinding = (
    category: FindingCategory,
    checkId: string,
    label: string,
    status: ValidationFinding["status"],
    detail: string,
    pageNumber?: number,
    extractedText?: string
  ) => {
    findingIdx++;
    findings.push({
      id: `f_${findingIdx}`,
      category,
      checkId,
      label,
      status,
      detail,
      pageNumber,
      extractedText,
    });
  };

  /* ================================================================
     1. CLAUSE VALIDATION — Check each template clause is present
     ================================================================ */

  for (const clause of templateClauses) {
    const clauseNormalized = normalize(clause.content);
    const clauseWords = clauseNormalized
      .split(" ")
      .filter((w) => w.length > 3);
    const sampleWords = clauseWords.slice(0, Math.min(10, clauseWords.length));

    if (sampleWords.length === 0) continue;

    const bgLower = bgText.toLowerCase();
    const foundCount = sampleWords.filter((w) => bgLower.includes(w)).length;
    const matchRatio = foundCount / sampleWords.length;

    // Also try bigram similarity on the full clause content
    let bestPageSimilarity = 0;
    let bestPage = 0;
    for (const page of bgPages) {
      const sim = similarity(clause.content, page.text);
      if (sim > bestPageSimilarity) {
        bestPageSimilarity = sim;
        bestPage = page.pageNumber;
      }
    }

    const combinedScore = Math.max(matchRatio, bestPageSimilarity);

    if (combinedScore >= 0.6) {
      addFinding(
        "Clause Validation",
        `clause_present_${clause.id}`,
        `Clause: ${clause.label.substring(0, 80)}`,
        "PASS",
        `Template clause detected in the document (match: ${Math.round(combinedScore * 100)}%).`,
        bestPage > 0 && bestPageSimilarity >= matchRatio ? bestPage : undefined
      );
    } else if (combinedScore >= 0.25) {
      addFinding(
        "Clause Validation",
        `clause_present_${clause.id}`,
        `Clause: ${clause.label.substring(0, 80)}`,
        "REVIEW",
        `Partial match detected (${Math.round(combinedScore * 100)}%). The clause may differ from the template. Manual review recommended.`,
        bestPage > 0 && bestPageSimilarity >= matchRatio ? bestPage : undefined
      );
    } else {
      addFinding(
        "Clause Validation",
        `clause_present_${clause.id}`,
        `Clause: ${clause.label.substring(0, 80)}`,
        "FAIL",
        `Template clause not found in the document. This clause may be missing or significantly altered.`
      );
    }
  }

  /* ================================================================
     2. EXTRA / ADDITIONAL CONTENT DETECTION
     ================================================================ */

  const templateWords = new Set(
    normalize(templateText)
      .split(" ")
      .filter((w) => w.length > 5)
  );
  const bgWordsNormalized = normalize(bgText).split(" ");
  const additionalWords = bgWordsNormalized.filter(
    (w) => w.length > 8 && !templateWords.has(w)
  );

  if (additionalWords.length > 30) {
    addFinding(
      "Clause Validation",
      "extra_content",
      "Additional Bank-Specific Content",
      "INFO",
      `The BG contains ${additionalWords.length} terms not found in the template. These may be bank-specific additions such as IFSC, SWIFT, branch details, or additional conditions.`
    );
  } else {
    addFinding(
      "Clause Validation",
      "extra_content",
      "Additional Content Check",
      "PASS",
      "No significant additional content beyond the template structure was detected."
    );
  }

  /* ================================================================
     3. CLAUSE ORDERING
     ================================================================ */

  if (templateClauses.length > 1) {
    const bgLower = bgText.toLowerCase();
    let orderingOk = true;
    let lastPosition = -1;
    let matchedClauses = 0;

    for (const clause of templateClauses) {
      const key = normalize(clause.content)
        .split(" ")
        .filter((w) => w.length > 4)
        .slice(0, 3);
      if (key.length === 0) continue;

      const pos = bgLower.indexOf(key[0]);
      if (pos >= 0) {
        matchedClauses++;
        if (pos < lastPosition) {
          orderingOk = false;
        }
        lastPosition = pos;
      }
    }

    if (matchedClauses < 2) {
      addFinding(
        "Clause Validation",
        "clause_ordering",
        "Clause Ordering",
        "REVIEW",
        "Could not reliably determine clause ordering. Too few clause markers matched."
      );
    } else if (orderingOk) {
      addFinding(
        "Clause Validation",
        "clause_ordering",
        "Clause Ordering",
        "PASS",
        "Clause order is consistent with the reference template."
      );
    } else {
      addFinding(
        "Clause Validation",
        "clause_ordering",
        "Clause Ordering",
        "REVIEW",
        "Clause ordering differs from the template. This may indicate structural modifications or reordering."
      );
    }
  }

  /* ================================================================
     4. TEMPLATE–BG FIELD MATCHING (cross-reference key fields)
     ================================================================ */

  // 4a. Beneficiary name
  const beneficiaryPatterns = [
    /(?:beneficiary|in favour of|in\s+favor\s+of)\s*[:.]?\s*(.+?)(?:\n|$)/gi,
  ];
  const templateBeneficiary = extractField(templateText, beneficiaryPatterns);
  const bgBeneficiary = extractField(bgText, beneficiaryPatterns);

  if (templateBeneficiary && bgBeneficiary) {
    const bSim = similarity(templateBeneficiary, bgBeneficiary);
    if (bSim >= 0.7) {
      addFinding(
        "Consistency Validation",
        "beneficiary_match",
        "Beneficiary Name",
        "PASS",
        `Beneficiary matches the template: "${bgBeneficiary}"`,
        undefined,
        bgBeneficiary
      );
    } else {
      addFinding(
        "Consistency Validation",
        "beneficiary_match",
        "Beneficiary Name",
        "FAIL",
        `Beneficiary in BG ("${bgBeneficiary}") differs from template ("${templateBeneficiary}"). This may be an error.`,
        undefined,
        bgBeneficiary
      );
    }
  } else if (bgBeneficiary) {
    addFinding(
      "Consistency Validation",
      "beneficiary_detected",
      "Beneficiary Name",
      "INFO",
      `Beneficiary detected in BG: "${bgBeneficiary}". No template reference to compare against.`,
      undefined,
      bgBeneficiary
    );
  } else if (templateBeneficiary) {
    addFinding(
      "Consistency Validation",
      "beneficiary_missing",
      "Beneficiary Name",
      "REVIEW",
      "No beneficiary name found in the BG. This field is typically required."
    );
  }

  // 4b. Applicant / Principal name
  const applicantPatterns = [
    /(?:applicant|principal|guarantor|we|the undersigned)\s*[:.]?\s*(.+?)(?:\n|$)/gi,
  ];
  const templateApplicant = extractField(templateText, applicantPatterns);
  const bgApplicant = extractField(bgText, applicantPatterns);

  if (templateApplicant && bgApplicant) {
    const aSim = similarity(templateApplicant, bgApplicant);
    if (aSim >= 0.6) {
      addFinding(
        "Consistency Validation",
        "applicant_match",
        "Applicant / Principal",
        "PASS",
        `Applicant matches the template: "${bgApplicant}"`,
        undefined,
        bgApplicant
      );
    } else {
      addFinding(
        "Consistency Validation",
        "applicant_match",
        "Applicant / Principal",
        "REVIEW",
        `Applicant in BG ("${bgApplicant}") differs from template ("${templateApplicant}"). Verify this is correct.`,
        undefined,
        bgApplicant
      );
    }
  } else if (bgApplicant) {
    addFinding(
      "Consistency Validation",
      "applicant_detected",
      "Applicant / Principal",
      "INFO",
      `Applicant detected: "${bgApplicant}". No template reference available.`,
      undefined,
      bgApplicant
    );
  }

  // 4c. Issuing Bank name
  const bankPatterns = [
    /(?:issuing bank|guarantor bank|bank)\s*[:.]?\s*(.+?)(?:\n|$)/gi,
  ];
  const templateBank = extractField(templateText, bankPatterns);
  const bgBank = extractField(bgText, bankPatterns);

  if (templateBank && bgBank) {
    const bkSim = similarity(templateBank, bgBank);
    if (bkSim >= 0.6) {
      addFinding(
        "Consistency Validation",
        "bank_name_match",
        "Issuing Bank",
        "PASS",
        `Issuing bank matches the template: "${bgBank}"`,
        undefined,
        bgBank
      );
    } else {
      addFinding(
        "Consistency Validation",
        "bank_name_match",
        "Issuing Bank",
        "REVIEW",
        `Issuing bank in BG ("${bgBank}") differs from template ("${templateBank}"). Verify this is the correct issuing institution.`,
        undefined,
        bgBank
      );
    }
  } else if (bgBank) {
    addFinding(
      "Consistency Validation",
      "bank_name_detected",
      "Issuing Bank",
      "INFO",
      `Issuing bank detected: "${bgBank}". No template reference available.`,
      undefined,
      bgBank
    );
  }

  /* ================================================================
     5. AMOUNT CONSISTENCY
     ================================================================ */

  const amountPatterns = [
    /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)/gi,
    /(?:USD|\$)\s*([\d,]+(?:\.\d{2})?)/gi,
    /(?:EUR|€)\s*([\d,]+(?:\.\d{2})?)/gi,
    /(?:GBP|£)\s*([\d,]+(?:\.\d{2})?)/gi,
    /(?:AED|SGD|JPY|AUD|CAD)\s*([\d,]+(?:\.\d{2})?)/gi,
    /(?:amount|sum|value|guarantee(?:ed)?\s+amount)\s*(?:of|:|for)?\s*(?:Rs\.?|INR|USD|EUR|GBP|₹|\$|€|£)?\s*([\d,]+(?:\.\d{2})?)/gi,
  ];

  const amounts: string[] = [];
  for (const pat of amountPatterns) {
    const matches = findAllMatches(bgText, pat);
    amounts.push(...matches.map((m) => m.replace(/,/g, "")));
  }

  if (amounts.length > 0) {
    const uniqueAmounts = [...new Set(amounts)];

    if (uniqueAmounts.length === 1) {
      addFinding(
        "Consistency Validation",
        "amount_consistency",
        "Amount Consistency",
        "PASS",
        `All amount references are consistent: ${amounts[0]}`
      );
    } else {
      addFinding(
        "Consistency Validation",
        "amount_consistency",
        "Amount Consistency",
        "FAIL",
        `Different amounts detected: ${uniqueAmounts.join(", ")}. Verify which is the correct guarantee amount.`,
        undefined,
        uniqueAmounts.join(", ")
      );
    }

    // Cross-check with template amount
    const templateAmounts: string[] = [];
    for (const pat of amountPatterns) {
      const matches = findAllMatches(templateText, pat);
      templateAmounts.push(...matches.map((m) => m.replace(/,/g, "")));
    }
    if (templateAmounts.length > 0) {
      const templateAmt = templateAmounts[0];
      const bgAmt = amounts[0];
      if (templateAmt === bgAmt) {
        addFinding(
          "Consistency Validation",
          "amount_template_match",
          "Amount vs Template",
          "PASS",
          `BG amount (${bgAmt}) matches the template amount (${templateAmt}).`
        );
      } else {
        addFinding(
          "Consistency Validation",
          "amount_template_match",
          "Amount vs Template",
          "REVIEW",
          `BG amount (${bgAmt}) differs from template amount (${templateAmt}). Verify if this is intentional.`
        );
      }
    }
  } else {
    addFinding(
      "Consistency Validation",
      "amount_detected",
      "Amount Detection",
      "REVIEW",
      "No explicit amount pattern detected. Verify the guarantee amount is clearly stated in the document."
    );
  }

  /* ================================================================
     6. AMOUNT IN WORDS vs FIGURES
     ================================================================ */

  const wordsPatterns = [
    /(?:Rupees|Dollars|Euros|Pounds)\s+(.+?)(?:\s+only|\s*[,.\n]|$)/gi,
  ];
  const wordAmounts: string[] = [];
  for (const pat of wordsPatterns) {
    const matches = findAllMatches(bgText, pat);
    wordAmounts.push(...matches);
  }

  if (wordAmounts.length > 0 && amounts.length > 0) {
    addFinding(
      "Consistency Validation",
      "amount_words_figures",
      "Amount in Words vs Figures",
      "REVIEW",
      `Amount in words detected: "${wordAmounts[0]}". Cross-verify with the numeric amount (${amounts[0]}).`,
      undefined,
      wordAmounts[0]
    );
  } else if (wordAmounts.length > 0) {
    addFinding(
      "Consistency Validation",
      "amount_words_only",
      "Amount in Words",
      "INFO",
      `Amount expressed in words: "${wordAmounts[0]}". No numeric amount found for comparison.`,
      undefined,
      wordAmounts[0]
    );
  } else if (amounts.length > 0) {
    // Amount found in figures but not in words — some BGs only have figures
    addFinding(
      "Consistency Validation",
      "amount_figures_only",
      "Amount in Figures Only",
      "INFO",
      `Amount found in numeric form (${amounts[0]}). No amount-in-words expression detected.`
    );
  }

  /* ================================================================
     7. BG NUMBER CONSISTENCY
     ================================================================ */

  const bgNumberPatterns = [
    /(?:BG|Guarantee|Guaranty|Bank\s+Guarantee)\s*(?:No|Number|Ref|Reference)\.?\s*[:.]?\s*([A-Z0-9\/\-]+)/gi,
    /(?:Ref(?:erence)?|Our\s+Ref)\.?\s*(?:No\.?)?\s*[:.]?\s*([A-Z0-9\/\-]+)/gi,
  ];

  const bgNumbers: string[] = [];
  for (const pat of bgNumberPatterns) {
    const matches = findAllMatches(bgText, pat);
    bgNumbers.push(...matches);
  }

  if (bgNumbers.length > 0) {
    const uniqueBgs = [...new Set(bgNumbers)];
    if (uniqueBgs.length === 1) {
      addFinding(
        "Consistency Validation",
        "bg_number",
        "BG Number",
        "PASS",
        `BG reference number is consistent: ${bgNumbers[0]}`,
        undefined,
        bgNumbers[0]
      );
    } else {
      addFinding(
        "Consistency Validation",
        "bg_number",
        "BG Number",
        "FAIL",
        `Multiple BG numbers detected: ${uniqueBgs.join(", ")}. Only one BG number should be present.`,
        undefined,
        uniqueBgs.join(", ")
      );
    }

    // Cross-check with template
    const templateBgNumbers: string[] = [];
    for (const pat of bgNumberPatterns) {
      const matches = findAllMatches(templateText, pat);
      templateBgNumbers.push(...matches);
    }
    if (templateBgNumbers.length > 0 && templateBgNumbers[0] !== bgNumbers[0]) {
      addFinding(
        "Consistency Validation",
        "bg_number_template",
        "BG Number vs Template",
        "REVIEW",
        `BG number (${bgNumbers[0]}) differs from template (${templateBgNumbers[0]}). Verify this is intentional.`
      );
    }
  }

  /* ================================================================
     8. CONTRACT / PO / LOA / FOA REFERENCES
     ================================================================ */

  const contractPatterns = [
    /(?:Contract|PO|Purchase\s+Order|LOA|Letter\s+of\s+Award|FOA|Work\s+Order|Agreement)\s*(?:No|Number|Ref|Reference)\.?\s*[:.]?\s*([A-Z0-9\/\-]+)/gi,
  ];

  const contracts: string[] = [];
  for (const pat of contractPatterns) {
    const matches = findAllMatches(bgText, pat);
    contracts.push(...matches);
  }

  if (contracts.length > 0) {
    const uniqueContracts = [...new Set(contracts)];
    if (uniqueContracts.length === 1) {
      addFinding(
        "Consistency Validation",
        "contract_ref",
        "Contract / PO Reference",
        "PASS",
        `Contract reference is consistent: ${contracts[0]}`,
        undefined,
        contracts[0]
      );
    } else {
      addFinding(
        "Consistency Validation",
        "contract_ref",
        "Contract / PO Reference",
        "REVIEW",
        `Multiple contract references detected: ${uniqueContracts.join(", ")}. Verify consistency.`,
        undefined,
        uniqueContracts.join(", ")
      );
    }

    // Cross-check with template
    const templateContracts: string[] = [];
    for (const pat of contractPatterns) {
      const matches = findAllMatches(templateText, pat);
      templateContracts.push(...matches);
    }
    if (templateContracts.length > 0 && templateContracts[0] !== contracts[0]) {
      addFinding(
        "Consistency Validation",
        "contract_template_match",
        "Contract Reference vs Template",
        "REVIEW",
        `Contract reference in BG (${contracts[0]}) differs from template (${templateContracts[0]}). Verify this is intentional.`
      );
    }
  }

  /* ================================================================
     9. DATE DETECTION & VALIDATION
     ================================================================ */

  // Match multiple date formats
  const datePatterns = [
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g,      // DD/MM/YYYY
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})\b/g,      // DD/MM/YY
    /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi, // DD Month YYYY
  ];

  const allDates: string[] = [];
  for (const pat of datePatterns) {
    let m;
    const localPat = new RegExp(pat.source, pat.flags);
    while ((m = localPat.exec(bgText)) !== null) {
      allDates.push(m[0]);
    }
  }

  if (allDates.length > 0) {
    addFinding(
      "Consistency Validation",
      "date_values",
      "Dates Detected",
      "INFO",
      `Dates found in the document: ${[...new Set(allDates)].join(", ")}.`
    );
  }

  // Date ordering check
  if (allDates.length >= 2) {
    const parseBgDate = (d: string): number | null => {
      // Try DD/MM/YYYY
      const parts = d.split(/[\/\-\.]/);
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        let year = parseInt(parts[2]);
        if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
        if (year < 100) year += 2000;
        return new Date(year, month - 1, day).getTime();
      }
      // Try "DD Month YYYY"
      const altMatch = d.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
      if (altMatch) {
        return new Date(`${altMatch[2]} ${altMatch[1]}, ${altMatch[3]}`).getTime();
      }
      return null;
    };

    const parsedDates = allDates
      .map(parseBgDate)
      .filter((d): d is number => d !== null);

    if (parsedDates.length >= 2) {
      const isChronological = parsedDates.every(
        (d, i) => i === 0 || d >= parsedDates[i - 1]
      );
      if (isChronological) {
        addFinding(
          "Logical Validation",
          "date_ordering",
          "Date Ordering",
          "PASS",
          "All dates appear in chronological order."
        );
      } else {
        addFinding(
          "Logical Validation",
          "date_ordering",
          "Date Ordering",
          "REVIEW",
          "Dates are not in chronological order. Verify issue and expiry dates are correct."
        );
      }
    }

    // Check for expiry date specifically
    const expiryPatterns = [
      /(?:expir[ey]|valid\s+until|validity\s+(?:up\s+)?to|expiry\s+date)\s*[:.]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
    ];
    const expiryMatch = extractField(bgText, expiryPatterns);

    // Check for issue date
    const issueDatePatterns = [
      /(?:date\s+of\s+(?:issue|execution)|issued?\s+(?:on|date)|dated?)\s*[:.]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
    ];
    const issueDate = extractField(bgText, issueDatePatterns);

    if (issueDate && expiryMatch) {
      addFinding(
        "Logical Validation",
        "date_issue_expiry",
        "Issue & Expiry Dates",
        "PASS",
        `Issue date: ${issueDate}, Expiry date: ${expiryMatch}. Both are present.`
      );
    } else if (expiryMatch) {
      addFinding(
        "Logical Validation",
        "date_expiry_found",
        "Expiry Date",
        "PASS",
        `Expiry date detected: ${expiryMatch}.`
      );
    } else if (issueDate) {
      addFinding(
        "Logical Validation",
        "date_issue_found",
        "Issue Date",
        "PASS",
        `Issue date detected: ${issueDate}.`
      );
    }
  }

  /* ================================================================
     10. CLAIM PERIOD / VALIDITY PERIOD
     ================================================================ */

  const claimPeriodPatterns = [
    /(?:claim|validity|period|validity\s+period)\s*(?:within|of|:)?\s*(\d+)\s*(days?|months?|years?|calender?\s+days?)/gi,
  ];

  const claimMatch = extractField(bgText, claimPeriodPatterns);

  if (claimMatch) {
    addFinding(
      "Logical Validation",
      "claim_period",
      "Claim / Validity Period",
      "PASS",
      `Claim/validity period specified: ${claimMatch}.`
    );

    // Cross-check with template
    const templateClaim = extractField(templateText, claimPeriodPatterns);
    if (templateClaim && templateClaim !== claimMatch) {
      addFinding(
        "Logical Validation",
        "claim_period_template",
        "Claim Period vs Template",
        "REVIEW",
        `BG claim period (${claimMatch}) differs from template (${templateClaim}). Verify this is intentional.`
      );
    }
  } else {
    addFinding(
      "Logical Validation",
      "claim_period",
      "Claim / Validity Period",
      "REVIEW",
      "No explicit claim or validity period found. Verify the guarantee has a defined validity."
    );
  }

  /* ================================================================
     11. REQUIRED CONDITIONS — On Demand / Irrevocable / Unconditional
     ================================================================ */

  const bgLower = bgText.toLowerCase();

  // On demand / first demand
  const hasOnDemand =
    bgLower.includes("on demand") ||
    bgLower.includes("first demand") ||
    bgLower.includes("on-first demand") ||
    bgLower.includes("at first demand");

  if (hasOnDemand) {
    addFinding(
      "Logical Validation",
      "on_demand",
      "On Demand / First Demand",
      "PASS",
      "On demand / first demand language detected. The guarantee can be called upon first written demand."
    );
  } else {
    addFinding(
      "Logical Validation",
      "on_demand",
      "On Demand / First Demand",
      "REVIEW",
      "No explicit 'on demand' or 'first demand' language found. Verify the guarantee type and call conditions."
    );
  }

  // Irrevocable
  const hasIrrevocable =
    bgLower.includes("irrevocable") || bgLower.includes("irrevocably");

  if (hasIrrevocable) {
    addFinding(
      "Logical Validation",
      "irrevocable",
      "Irrevocable",
      "PASS",
      "Irrevocable language detected. The guarantee cannot be amended or cancelled without consent."
    );
  } else {
    addFinding(
      "Logical Validation",
      "irrevocable",
      "Irrevocable",
      "REVIEW",
      "No explicit 'irrevocable' language found. Verify whether the guarantee is irrevocable."
    );
  }

  // Unconditional
  const hasUnconditional =
    bgLower.includes("unconditional") || bgLower.includes("unconditionally");

  if (hasUnconditional) {
    addFinding(
      "Logical Validation",
      "unconditional",
      "Unconditional",
      "PASS",
      "Unconditional language detected. The guarantee has no conditions attached to the call."
    );
  } else {
    addFinding(
      "Logical Validation",
      "unconditional",
      "Unconditional",
      "INFO",
      "No explicit 'unconditional' language found. Some guarantees use alternative phrasing."
    );
  }

  /* ================================================================
     12. CURRENCY CONSISTENCY
     ================================================================ */

  const currencyRegex = /\b(USD|EUR|GBP|INR|AED|SGD|JPY|AUD|CAD|CHF|CNY|HKD|MYR|THB|ZAR)\b/gi;
  const currencies = bgText.match(currencyRegex);

  if (currencies) {
    const uniqueCurrencies = [...new Set(currencies.map((c) => c.toUpperCase()))];
    if (uniqueCurrencies.length > 1) {
      addFinding(
        "Logical Validation",
        "currency_consistency",
        "Currency Consistency",
        "FAIL",
        `Multiple currencies detected: ${uniqueCurrencies.join(", ")}. This may indicate an error unless the document legitimately references multiple currencies.`
      );
    } else {
      addFinding(
        "Logical Validation",
        "currency_consistency",
        "Currency Consistency",
        "PASS",
        `Consistent currency detected: ${uniqueCurrencies[0]}.`
      );
    }

    // Cross-check with template
    const templateCurrencies = templateText.match(currencyRegex);
    if (templateCurrencies) {
      const templateCurr = [...new Set(templateCurrencies.map((c) => c.toUpperCase()))];
      if (templateCurr.length > 0 && templateCurr[0] !== uniqueCurrencies[0]) {
        addFinding(
          "Logical Validation",
          "currency_template_match",
          "Currency vs Template",
          "FAIL",
          `BG currency (${uniqueCurrencies[0]}) differs from template currency (${templateCurr[0]}). This is likely an error.`
        );
      }
    }
  }

  /* ================================================================
     13. BG TYPE DETECTION
     ================================================================ */

  const bgTypePatterns = [
    /(?:performance|financial|advance\s+payment|bid\s+bank\s+guarantee|retention|shipping|warranty|defective\s+corrective)/gi,
  ];

  const detectedTypes: string[] = [];
  for (const pat of bgTypePatterns) {
    const matches = bgText.match(pat);
    if (matches) {
      detectedTypes.push(...matches.map((m) => m.trim()));
    }
  }

  if (detectedTypes.length > 0) {
    const uniqueTypes = [...new Set(detectedTypes.map((t) => t.toLowerCase()))];
    addFinding(
      "Logical Validation",
      "bg_type",
      "Bank Guarantee Type",
      "INFO",
      `Detected guarantee type(s): ${uniqueTypes.join(", ")}.`
    );

    // Cross-check with template
    const templateTypes: string[] = [];
    for (const pat of bgTypePatterns) {
      const matches = templateText.match(pat);
      if (matches) {
        templateTypes.push(...matches.map((m) => m.trim().toLowerCase()));
      }
    }
    if (templateTypes.length > 0) {
      const typeOverlap = uniqueTypes.filter((t) => templateTypes.includes(t));
      if (typeOverlap.length > 0) {
        addFinding(
          "Logical Validation",
          "bg_type_template",
          "BG Type vs Template",
          "PASS",
          `BG type (${typeOverlap.join(", ")}) matches the template type.`
        );
      } else {
        addFinding(
          "Logical Validation",
          "bg_type_template",
          "BG Type vs Template",
          "REVIEW",
          `BG type (${uniqueTypes.join(", ")}) differs from template type (${templateTypes.join(", ")}). Verify this is intentional.`
        );
      }
    }
  }

  /* ================================================================
     14. SIGNATURE / AUTHORIZATION INDICATORS
     ================================================================ */

  const signatureTerms = [
    "authorized signatory",
    "authorised signatory",
    "authorized signatories",
    "authorised signatories",
    "signed by",
    "signature",
    "duly authorised",
    "duly authorized",
    "signatory",
    "signing authority",
    "name and designation",
    "authorized signatory for",
    "for and on behalf of",
  ];

  const hasSignature = signatureTerms.some((term) => bgLower.includes(term));

  if (hasSignature) {
    // Try to find which page the signature text is on
    let sigPage = 0;
    for (const page of bgPages) {
      const pageLower = page.text.toLowerCase();
      if (signatureTerms.some((term) => pageLower.includes(term))) {
        sigPage = page.pageNumber;
        break;
      }
    }

    addFinding(
      "Document Validation",
      "signature_indicators",
      "Signature / Authorization Indicators",
      "PASS",
      "Signature or authorization indicators detected in the document.",
      sigPage > 0 ? sigPage : undefined
    );
  } else {
    addFinding(
      "Document Validation",
      "signature_indicators",
      "Signature / Authorization Indicators",
      "REVIEW",
      "No explicit signature or authorization indicators found. Manual verification required."
    );
  }

  /* ================================================================
     15. STAMP / E-STAMP INDICATORS
     ================================================================ */

  const stampTerms = [
    "stamp",
    "e-stamp",
    "estamp",
    "revenue stamp",
    "stamp duty",
    "duty paid",
    "stamped",
  ];

  const hasStamp = stampTerms.some((term) => bgLower.includes(term));

  if (hasStamp) {
    addFinding(
      "Document Validation",
      "stamp_indicators",
      "Stamp / E-Stamp Indicators",
      "PASS",
      "Stamp or e-stamp indicators detected in the document."
    );
  } else {
    addFinding(
      "Document Validation",
      "stamp_indicators",
      "Stamp / E-Stamp Indicators",
      "INFO",
      "No stamp indicators found. Stamps may not be required for all BG types or jurisdictions."
    );
  }

  /* ================================================================
     16. ADDRESS / CONTACT FIELD DETECTION
     ================================================================ */

  const addressPatterns = [
    /(?:address|registered\s+office|corporate\s+office|branch\s+office)\s*[:.]?\s*(.+?)(?:\n|$)/gi,
  ];
  const bgAddress = extractField(bgText, addressPatterns);

  if (bgAddress && bgAddress.length > 10) {
    addFinding(
      "Document Validation",
      "address_detected",
      "Address Information",
      "INFO",
      `Address detected in the document: "${bgAddress.substring(0, 120)}${bgAddress.length > 120 ? "…" : ""}"`,
      undefined,
      bgAddress.substring(0, 120)
    );
  }

  /* ================================================================
     17. DOCUMENT TEXT QUALITY
     ================================================================ */

  const wordCount = bgText.split(/\s+/).filter((w) => w.length > 0).length;
  const charCount = bgText.replace(/\s/g, "").length;

  if (wordCount < 30 || charCount < 100) {
    addFinding(
      "Document Validation",
      "low_text_quality",
      "Document Text Quality",
      "FAIL",
      `Only ${wordCount} words (${charCount} characters) extracted. The document may be corrupted, empty, or require better OCR processing.`
    );
  } else if (wordCount < 100) {
    addFinding(
      "Document Validation",
      "low_text_quality",
      "Document Text Quality",
      "REVIEW",
      `Only ${wordCount} words extracted. Some content may be missing or difficult to extract. Check the extracted text for completeness.`
    );
  } else {
    addFinding(
      "Document Validation",
      "low_text_quality",
      "Document Text Quality",
      "PASS",
      `Document contains ${wordCount} words. Text extraction appears successful.`
    );
  }

  /* ================================================================
     18. SCANNED DOCUMENT QUALITY CHECKS
     ================================================================ */

  // Check if any pages are scanned and report per-page quality
  const scannedPages = bgPages.filter((p) => p.isScanned === true);
  if (scannedPages.length > 0) {
    addFinding(
      "Document Validation",
      "scanned_pages",
      "Scanned Pages Detected",
      "INFO",
      `${scannedPages.length} of ${bgPages.length} page(s) were detected as scanned and processed via OCR. Results may vary depending on scan quality.`
    );

    // Report per-page low-confidence OCR
    for (const page of scannedPages) {
      if (page.confidence != null && page.confidence < 0.5) {
        addFinding(
          "Document Validation",
          `page_quality_${page.pageNumber}`,
          `Page ${page.pageNumber} — Low OCR Confidence`,
          "REVIEW",
          `Page ${page.pageNumber} had low OCR confidence (${Math.round(page.confidence * 100)}%). The extracted text on this page may contain errors.`,
          page.pageNumber
        );
      }
    }
  }

  // Check for garbled / OCR artifact patterns
  const garbledPatterns = bgText.match(/[^\x00-\x7F]{5,}/g);
  if (garbledPatterns && garbledPatterns.length > 3) {
    addFinding(
      "Document Validation",
      "garbled_text",
      "Garbled Text Detected",
      "REVIEW",
      `${garbledPatterns.length} garbled text sequences found. These may be OCR artifacts or encoding issues from scanned documents.`
    );
  }

  /* ================================================================
     19. LAYOUT STRUCTURE CHECKS
     ================================================================ */

  const hasTitle = bgLower.includes("bank guarantee") || bgLower.includes("guarantee");
  const hasParties =
    bgLower.includes("beneficiary") ||
    bgLower.includes("applicant") ||
    bgLower.includes("principal");
  const hasAmount = amounts.length > 0;
  const hasDates = allDates.length > 0;
  const hasTerms =
    bgLower.includes("terms and conditions") ||
    bgLower.includes("conditions") ||
    bgLower.includes("terms of");

  const structureElements = [
    hasTitle && "title",
    hasParties && "parties",
    hasAmount && "amount",
    hasDates && "dates",
    hasTerms && "terms",
  ].filter(Boolean);

  const structureScore = structureElements.length / 5;

  if (structureScore >= 0.8) {
    addFinding(
      "Document Validation",
      "structure_check",
      "Document Structure",
      "PASS",
      `Document structure appears complete (${structureElements.join(", ")}).`
    );
  } else if (structureScore >= 0.4) {
    addFinding(
      "Document Validation",
      "structure_check",
      "Document Structure",
      "REVIEW",
      `Only ${structureElements.length} of 5 key structural elements detected (${structureElements.join(", ")}). Some elements may be missing or use non-standard formatting.`
    );
  } else {
    addFinding(
      "Document Validation",
      "structure_check",
      "Document Structure",
      "FAIL",
      `Only ${structureElements.length} of 5 key structural elements found. The document may not be a valid Bank Guarantee.`
    );
  }

  /* ================================================================
     20. MUTUAL CONSENT / AMENDMENT CLAUSE
     ================================================================ */

  const hasMutualConsent =
    bgLower.includes("mutual consent") ||
    bgLower.includes("without the consent") ||
    bgLower.includes("amendment");

  if (hasMutualConsent) {
    addFinding(
      "Logical Validation",
      "amendment_clause",
      "Amendment / Consent Clause",
      "PASS",
      "Amendment or mutual consent clause detected. The guarantee cannot be modified without agreement."
    );
  }

  /* ================================================================
     21. GOVERNING LAW / JURISDICTION
     ================================================================ */

  const governingLawPatterns = [
    /(?:governing\s+law|subject\s+to|jurisdiction|laws?\s+of)\s*[:.]?\s*(.+?)(?:\n|$)/gi,
  ];
  const governingLaw = extractField(bgText, governingLawPatterns);

  if (governingLaw) {
    addFinding(
      "Logical Validation",
      "governing_law",
      "Governing Law / Jurisdiction",
      "PASS",
      `Governing law or jurisdiction clause detected: "${governingLaw.substring(0, 100)}"`,
      undefined,
      governingLaw.substring(0, 100)
    );
  }

  /* ================================================================
     22. OPTIONAL / BANK-SPECIFIC INFORMATION (INFO only, never FAIL)
     ================================================================ */

  // IFSC Code
  const ifscMatch = bgText.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/);
  if (ifscMatch) {
    addFinding(
      "Optional Information",
      "ifsc_code",
      "IFSC Code",
      "INFO",
      `IFSC code detected: ${ifscMatch[1]}. This is additional bank-specific information.`,
      undefined,
      ifscMatch[1]
    );
  }

  // SWIFT/BIC Code (more precise pattern)
  const swiftMatch = bgText.match(/\b([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/);
  if (swiftMatch) {
    const swift = swiftMatch[1];
    const exclusions = [
      "ACCOUNT", "ADDRESS", "COMPANY", "GUARANTEE", "BENEFICIARY",
      "APPLICANT", "BANKING", "CHARGES", "CUSTOMER", "DETAILS",
      "DOCUMENT", "FINANCE", "GUARANTEE", "INDICATE", "ISSUANCE",
      "LETTERS", "MENTION", "NOMINAL", "ORIGINAL", "PAYMENT",
      "REQUIRE", "SECTION", "TARIFF", "UNIQUE", "VARIANCE",
    ];
    if (!exclusions.includes(swift)) {
      addFinding(
        "Optional Information",
        "swift_code",
        "SWIFT / BIC Code",
        "INFO",
        `SWIFT/BIC code detected: ${swift}. This is additional bank-specific information.`,
        undefined,
        swift
      );
    }
  }

  // Branch information
  const branchMatch = bgText.match(/branch\s*[:.]?\s*(.+?)(?:\n|$)/i);
  if (branchMatch) {
    addFinding(
      "Optional Information",
      "branch_info",
      "Branch Information",
      "INFO",
      `Branch information detected: ${branchMatch[1].trim().substring(0, 100)}`,
      undefined,
      branchMatch[1].trim().substring(0, 100)
    );
  }

  // Email address
  const emailMatch = bgText.match(/[\w.-]+@[\w.-]+\.[A-Za-z]{2,}/);
  if (emailMatch) {
    addFinding(
      "Optional Information",
      "email",
      "Email Contact",
      "INFO",
      `Email address detected: ${emailMatch[0]}`,
      undefined,
      emailMatch[0]
    );
  }

  // Phone number (more precise)
  const phoneMatch = bgText.match(/(?:\+91[\s-]?)?0?\d{10}\b/);
  if (phoneMatch) {
    addFinding(
      "Optional Information",
      "phone",
      "Phone Contact",
      "INFO",
      `Phone number detected: ${phoneMatch[0]}`,
      undefined,
      phoneMatch[0]
    );
  }

  // GST / PAN / TAN numbers
  const gstMatch = bgText.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]\b/);
  if (gstMatch) {
    addFinding(
      "Optional Information",
      "gst_number",
      "GST Number",
      "INFO",
      `GST number detected: ${gstMatch[0]}`,
      undefined,
      gstMatch[0]
    );
  }

  const panMatch = bgText.match(/\b[A-Z]{5}\d{4}[A-Z]\b/);
  if (panMatch) {
    addFinding(
      "Optional Information",
      "pan_number",
      "PAN Number",
      "INFO",
      `PAN number detected: ${panMatch[0]}`,
      undefined,
      panMatch[0]
    );
  }

  /* ================================================================
     RETURN
     ================================================================ */

  return findings;
}

/* ──────────────────────────────────────────────────────────────
   COMPUTE OVERALL RESULT
   ────────────────────────────────────────────────────────────── */

export function computeResult(
  findings: ValidationFinding[],
  documentType: string,
  pageCount: number,
  extractedText: string
): ValidationResult {
  const passCount = findings.filter((f) => f.status === "PASS").length;
  const reviewCount = findings.filter((f) => f.status === "REVIEW").length;
  const failCount = findings.filter((f) => f.status === "FAIL").length;
  const infoCount = findings.filter((f) => f.status === "INFO").length;

  let status: "VALID" | "REVIEW" | "DISCREPANT" = "VALID";
  if (failCount > 0) {
    status = "DISCREPANT";
  } else if (reviewCount > 0) {
    status = "REVIEW";
  }

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
