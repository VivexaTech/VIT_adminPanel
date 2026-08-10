export type ReceiptData = {
  receiptNo: string;
  date: string;
  studentName: string;
  studentId: string;
  mobile?: string;
  courseName: string;
  batchName?: string;
  feeType?: string;
  paymentMode: string;
  transactionRef?: string;
  paymentDate?: string;
  lineItems: { description: string; amount: number }[];
  /** Gross course fee before discount */
  originalFee?: number;
  /** Discount amount in ₹ */
  discount?: number;
  /** Optional discount note/code */
  discountNote?: string;
  /** Net / payable fee after discount */
  totalFee: number;
  previouslyPaid: number;
  currentPayment: number;
  remainingBalance: number;
  logoUrl?: string;
  authorizedSignatureUrl?: string;
  instituteName?: string;
  institutePhone?: string;
  instituteEmail?: string;
  instituteAddress?: string;
};

function formatINR(amount: number): string {
  return Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso || "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const DEFAULT_LOGO = "https://vit.vivexatech.in/web-app-manifest-512x512.png";

/**
 * Professional A4 fee receipt/invoice — self-contained (no external fonts).
 * Safe for iframe preview, browser print, and PDF capture.
 */
export function buildReceiptHtml(
  data: ReceiptData,
  options?: { includePrintButton?: boolean }
): string {
  const instituteName = escapeHtml(data.instituteName || "VIVEXA INSTITUTE OF TECHNOLOGY");
  const phone = escapeHtml(data.institutePhone || "+91 9582194338, +91 9354486861");
  const email = escapeHtml(data.instituteEmail || "contact@vivexatech.in");
  const address = escapeHtml(data.instituteAddress || "Gurugram, Haryana");
  const logoSrc = escapeHtml(data.logoUrl?.trim() || DEFAULT_LOGO);
  const paymentDate = data.paymentDate || data.date;
  const feeType = data.feeType || "Course Fee Payment";

  const rows = (data.lineItems || [])
    .map(
      (item, i) =>
        `<tr>
          <td class="c-sno">${i + 1}</td>
          <td>${escapeHtml(item.description || feeType)}</td>
          <td class="c-amt">₹${formatINR(item.amount)}</td>
        </tr>`
    )
    .join("");

  const printBtn = options?.includePrintButton
    ? `<button class="print-btn" type="button" onclick="window.print()">Print Receipt</button>`
    : "";

  const signatureBlock = data.authorizedSignatureUrl?.trim()
    ? `<img src="${escapeHtml(data.authorizedSignatureUrl.trim())}" alt="Signature" class="sign-img" /><p>Authorized Signatory</p>`
    : `<div class="sign-line"></div><p>Authorized Signatory</p>`;

  const metaRows = [
    ["Student Name", data.studentName],
    ["Student ID / Admission No", data.studentId],
    data.mobile ? ["Mobile No", data.mobile] : null,
    ["Course", data.courseName],
    data.batchName ? ["Batch", data.batchName] : null,
    ["Fee Type", feeType],
    ["Payment Mode", data.paymentMode],
    data.transactionRef ? ["Transaction / Ref No", data.transactionRef] : null,
    ["Payment Date", formatDisplayDate(paymentDate)],
  ]
    .filter(Boolean)
    .map(
      (row) =>
        `<div class="meta-row"><span>${escapeHtml((row as string[])[0])}</span><strong>${escapeHtml(
          (row as string[])[1] || "—"
        )}</strong></div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Fee Receipt — ${escapeHtml(data.receiptNo)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    background: #ffffff;
    color: #0f172a;
    padding: 20px 16px 32px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .print-btn {
    display: block;
    margin: 0 auto 16px;
    padding: 12px 28px;
    border: 0;
    border-radius: 8px;
    background: #0f172a;
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }
  .sheet {
    position: relative;
    max-width: 820px;
    margin: 0 auto;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 36px 40px 28px;
    overflow: hidden;
  }
  .watermark {
    position: absolute;
    top: 48%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-28deg);
    font-size: 100px;
    font-weight: 800;
    letter-spacing: 12px;
    color: rgba(34, 197, 94, 0.08);
    z-index: 0;
    pointer-events: none;
    user-select: none;
  }
  .content { position: relative; z-index: 1; }
  .header {
    display: flex;
    align-items: center;
    gap: 18px;
    padding-bottom: 18px;
    border-bottom: 3px solid #0f172a;
    margin-bottom: 20px;
  }
  .logo {
    width: 80px;
    height: 80px;
    object-fit: contain;
    border-radius: 10px;
    background: #0b1220;
    flex-shrink: 0;
  }
  .brand { flex: 1; min-width: 0; }
  .brand h1 {
    font-size: 20px;
    line-height: 1.25;
    font-weight: 800;
    color: #0f172a;
    text-transform: uppercase;
  }
  .brand .tag {
    margin-top: 4px;
    font-size: 12px;
    font-weight: 600;
    color: #334155;
  }
  .brand .contact {
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.55;
    color: #64748b;
  }
  .title-block { text-align: right; flex-shrink: 0; }
  .title-block h2 {
    font-size: 26px;
    font-weight: 900;
    letter-spacing: 2px;
    color: #94a3b8;
    text-transform: uppercase;
    line-height: 1;
  }
  .title-block .rid {
    margin-top: 8px;
    font-size: 12px;
    color: #64748b;
  }
  .title-block .rid strong {
    color: #0f172a;
    font-family: ui-monospace, Consolas, monospace;
  }
  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 24px;
    margin-bottom: 22px;
    padding: 14px 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
  }
  .meta-row {
    display: flex;
    gap: 10px;
    font-size: 13px;
    align-items: baseline;
  }
  .meta-row span {
    width: 140px;
    flex-shrink: 0;
    color: #64748b;
    font-weight: 600;
  }
  .meta-row strong {
    color: #0f172a;
    font-weight: 700;
    word-break: break-word;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
  }
  thead th {
    background: #0f172a;
    color: #fff;
    text-align: left;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 11px 14px;
  }
  thead th.c-amt { text-align: right; }
  tbody td {
    padding: 13px 14px;
    border-bottom: 1px solid #e2e8f0;
    font-size: 14px;
    color: #1e293b;
    vertical-align: top;
  }
  td.c-sno { width: 64px; color: #64748b; }
  td.c-amt, th.c-amt { text-align: right; font-weight: 700; white-space: nowrap; }
  .totals {
    width: 340px;
    margin-left: auto;
    margin-bottom: 28px;
  }
  .t-row {
    display: flex;
    justify-content: space-between;
    padding: 9px 12px;
    font-size: 13px;
    border-bottom: 1px solid #e2e8f0;
    color: #475569;
  }
  .t-row strong { color: #0f172a; }
  .t-row.paid {
    margin-top: 8px;
    background: #0f172a;
    color: #fff;
    border: 0;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 700;
    padding: 12px 14px;
  }
  .t-row.paid strong { color: #fff; }
  .t-row.discount {
    color: #047857;
  }
  .t-row.discount strong { color: #047857; }
  .t-row.due {
    margin-top: 8px;
    background: #fef2f2;
    color: #b91c1c;
    border: 0;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 700;
    padding: 11px 14px;
  }
  .t-row.due strong { color: #b91c1c; }
  .signs {
    display: flex;
    justify-content: space-between;
    gap: 40px;
    margin-top: 40px;
    padding-top: 8px;
  }
  .sign { width: 220px; text-align: center; }
  .sign-line {
    border-bottom: 1px solid #94a3b8;
    height: 48px;
    margin-bottom: 8px;
  }
  .sign-img {
    display: block;
    max-width: 180px;
    max-height: 64px;
    object-fit: contain;
    margin: 0 auto 8px;
  }
  .sign p {
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .note {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px dashed #cbd5e1;
    text-align: center;
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.5;
  }
  @media print {
    body { background: #fff; padding: 0; }
    .print-btn { display: none !important; }
    .sheet {
      box-shadow: none;
      border: 0;
      border-radius: 0;
      max-width: 100%;
      padding: 12px 16px;
    }
  }
  @page { size: A4; margin: 10mm; }
  @media (max-width: 640px) {
    .meta { grid-template-columns: 1fr; }
    .header { flex-wrap: wrap; }
    .title-block { text-align: left; width: 100%; }
  }
</style>
</head>
<body>
  ${printBtn}
  <div class="sheet" id="vit-receipt-sheet">
    <div class="watermark">PAID</div>
    <div class="content">
      <div class="header">
        <img class="logo" src="${logoSrc}" alt="Institute Logo" />
        <div class="brand">
          <h1>${instituteName}</h1>
          <p class="tag">Professional Computer &amp; IT Training Institute</p>
          <p class="contact">
            ${address}<br/>
            <strong>Phone:</strong> ${phone}<br/>
            <strong>Email:</strong> ${email}
          </p>
        </div>
        <div class="title-block">
          <h2>Invoice</h2>
          <p class="rid">Receipt No: <strong>${escapeHtml(data.receiptNo)}</strong></p>
          <p class="rid">Date: <strong>${escapeHtml(formatDisplayDate(data.date))}</strong></p>
        </div>
      </div>

      <div class="meta">
        ${metaRows}
      </div>

      <table>
        <thead>
          <tr>
            <th class="c-sno">S.No.</th>
            <th>Fee Description</th>
            <th class="c-amt">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows ||
            `<tr><td class="c-sno">1</td><td>${escapeHtml(feeType)}</td><td class="c-amt">₹${formatINR(
              data.currentPayment
            )}</td></tr>`
          }
        </tbody>
      </table>

      <div class="totals">
        ${(() => {
          const discountAmt = Number(data.discount) || 0;
          const payable = Number(data.totalFee) || 0;
          const gross =
            Number(data.originalFee) > 0
              ? Number(data.originalFee)
              : discountAmt > 0
                ? payable + discountAmt
                : payable;
          const discountLabel = data.discountNote
            ? `Discount (${escapeHtml(data.discountNote)})`
            : "Discount";
          return `
        <div class="t-row"><span>Course Fee</span><strong>₹${formatINR(gross)}</strong></div>
        ${
          discountAmt > 0
            ? `<div class="t-row discount"><span>${discountLabel}</span><strong>- ₹${formatINR(
                discountAmt
              )}</strong></div>
        <div class="t-row"><span>Payable Fee</span><strong>₹${formatINR(payable)}</strong></div>`
            : `<div class="t-row"><span>Payable Fee</span><strong>₹${formatINR(payable)}</strong></div>`
        }
        <div class="t-row"><span>Previously Paid</span><strong>₹${formatINR(data.previouslyPaid)}</strong></div>
        <div class="t-row paid"><span>Paid Amount</span><strong>₹${formatINR(data.currentPayment)}</strong></div>
        <div class="t-row due"><span>Due Amount</span><strong>₹${formatINR(data.remainingBalance)}</strong></div>`;
        })()}
      </div>

      <div class="signs">
        <div class="sign">
          <div class="sign-line"></div>
          <p>Student Signature</p>
        </div>
        <div class="sign">${signatureBlock}</div>
      </div>

      <div class="note">
        This is a computer-generated invoice/receipt issued by ${instituteName}.<br/>
        It is valid without a physical signature.
      </div>
    </div>
  </div>
</body>
</html>`;
}
