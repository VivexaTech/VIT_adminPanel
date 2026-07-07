export type ReceiptData = {
  receiptNo: string;
  date: string;
  studentName: string;
  studentId: string;
  mobile?: string;
  courseName: string;
  paymentMode: string;
  lineItems: { description: string; amount: number }[];
  totalFee: number;
  previouslyPaid: number;
  currentPayment: number;
  remainingBalance: number;
};

function formatINR(amount: number): string {
  return amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function buildReceiptHtml(data: ReceiptData, options?: { includePrintButton?: boolean }): string {
  const rows = data.lineItems
    .map(
      (item, i) =>
        `<tr><td>${i + 1}</td><td>${item.description}</td><td class="text-right">₹${formatINR(item.amount)}</td></tr>`
    )
    .join("");

  const printBtn = options?.includePrintButton
    ? `<button class="print-btn" onclick="window.print()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        Print Receipt
      </button>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Fee Receipt - Vivexa Institute of Technology</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root { --primary-color: #0f172a; --text-main: #334155; --text-muted: #64748b; --border-color: #e2e8f0; }
* { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', sans-serif; }
body { background: #f1f5f9; padding: 40px 20px; color: var(--text-main); }
.print-btn { margin: 0 auto 30px auto; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 28px; border: none; background: var(--primary-color); color: white; font-size: 15px; font-weight: 500; cursor: pointer; border-radius: 6px; }
.receipt { position: relative; max-width: 800px; margin: auto; background: #fff; padding: 50px; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); border-radius: 8px; overflow: hidden; }
.watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 120px; font-weight: 800; color: rgba(34, 197, 94, 0.05); z-index: 0; pointer-events: none; letter-spacing: 10px; }
.header { display: flex; align-items: center; border-bottom: 2px solid var(--primary-color); padding-bottom: 25px; margin-bottom: 30px; position: relative; z-index: 1; }
.logo { width: 100px; border-radius: 8px; margin-right: 25px; }
.company-details { flex-grow: 1; }
.company-details h1 { font-size: 24px; color: var(--primary-color); font-weight: 700; margin-bottom: 5px; }
.company-details .subtitle { font-size: 14px; font-weight: 500; margin-bottom: 8px; }
.company-details .contact { font-size: 13px; color: var(--text-muted); line-height: 1.6; }
.receipt-title { text-align: right; }
.receipt-title h2 { font-size: 28px; color: var(--border-color); text-transform: uppercase; letter-spacing: 2px; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px 30px; margin-bottom: 40px; position: relative; z-index: 1; }
.info-item { font-size: 14px; }
.info-item span.label { color: var(--text-muted); font-weight: 500; display: inline-block; width: 120px; }
.info-item span.value { font-weight: 600; color: var(--primary-color); }
table { width: 100%; border-collapse: collapse; margin-bottom: 30px; position: relative; z-index: 1; }
table th { background: #f8fafc; padding: 12px 15px; text-align: left; font-size: 13px; text-transform: uppercase; color: var(--text-muted); font-weight: 600; border-bottom: 2px solid var(--border-color); }
table td { padding: 15px; border-bottom: 1px solid var(--border-color); font-size: 14px; }
.text-right { text-align: right !important; }
.totals-wrapper { display: flex; justify-content: flex-end; position: relative; z-index: 1; }
.totals { width: 350px; }
.total-row { display: flex; justify-content: space-between; padding: 10px 15px; font-size: 14px; border-bottom: 1px solid var(--border-color); }
.total-row.grand-total { background: var(--primary-color); color: white; font-size: 16px; font-weight: 600; border-radius: 6px; margin-top: 10px; padding: 12px 15px; border: none; }
.total-row.balance-due { background: #fef2f2; color: #dc2626; font-size: 15px; font-weight: 600; border-radius: 6px; margin-top: 10px; padding: 12px 15px; border: none; }
.footer { display: flex; justify-content: space-between; margin-top: 70px; position: relative; z-index: 1; }
.sign-box { text-align: center; width: 200px; }
.sign-line { border-bottom: 1px solid var(--text-main); margin-bottom: 10px; height: 40px; }
.sign-box p { font-size: 13px; color: var(--text-muted); font-weight: 500; }
.note { margin-top: 40px; padding-top: 20px; border-top: 1px dashed var(--border-color); font-size: 12px; color: var(--text-muted); text-align: center; position: relative; z-index: 1; }
@media print { body { background: white; padding: 0; } .print-btn { display: none; } .receipt { box-shadow: none; border-radius: 0; max-width: 100%; padding: 40px; } }
</style>
</head>
<body>
${printBtn}
<div class="receipt">
  <div class="watermark">PAID</div>
  <div class="header">
    <img src="https://vit.vivexatech.in/web-app-manifest-512x512.png" alt="VIT Logo" class="logo">
    <div class="company-details">
      <h1>VIVEXA INSTITUTE OF TECHNOLOGY</h1>
      <p class="subtitle">Professional Computer & IT Training Institute</p>
      <p class="contact">Powered by Vivexa Tech | Gurugram, Haryana<br><strong>Phone:</strong> +91 9582194338, +91 9354486861</p>
    </div>
    <div class="receipt-title"><h2>Receipt</h2></div>
  </div>
  <div class="info-grid">
    <div class="info-item"><span class="label">Receipt No:</span><span class="value">${data.receiptNo}</span></div>
    <div class="info-item"><span class="label">Date:</span><span class="value">${formatDisplayDate(data.date)}</span></div>
    <div class="info-item"><span class="label">Student Name:</span><span class="value">${data.studentName}</span></div>
    <div class="info-item"><span class="label">Student ID:</span><span class="value">${data.studentId}</span></div>
    ${data.mobile ? `<div class="info-item"><span class="label">Mobile No:</span><span class="value">${data.mobile}</span></div>` : ""}
    <div class="info-item"><span class="label">Course Name:</span><span class="value">${data.courseName}</span></div>
    <div class="info-item"><span class="label">Payment Mode:</span><span class="value">${data.paymentMode}</span></div>
  </div>
  <table>
    <thead><tr><th>S.No.</th><th>Fee Description</th><th class="text-right">Amount (₹)</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals-wrapper">
    <div class="totals">
      <div class="total-row"><span>Total Fee</span><span>₹${formatINR(data.totalFee)}</span></div>
      <div class="total-row"><span>Previously Paid</span><span>₹${formatINR(data.previouslyPaid)}</span></div>
      <div class="total-row grand-total"><span>Current Payment</span><span>₹${formatINR(data.currentPayment)}</span></div>
      <div class="total-row balance-due"><span>Remaining Balance</span><span>₹${formatINR(data.remainingBalance)}</span></div>
    </div>
  </div>
  <div class="footer">
    <div class="sign-box"><div class="sign-line"></div><p>Student Signature</p></div>
    <div class="sign-box"><div class="sign-line"></div><p>Authorized Signatory</p></div>
  </div>
  <div class="note">This is a computer-generated receipt issued by Vivexa Institute of Technology and does not require a physical signature.</div>
</div>
</body>
</html>`;
}
