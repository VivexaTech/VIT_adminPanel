import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL || "noreply@vivexatech.in";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendStudentCredentialsEmail(opts: {
  to: string;
  studentName: string;
  studentId: string;
  loginEmail: string;
  password: string;
  course: string;
  batch?: string;
}) {
  if (!resend) throw new Error("Resend API is not configured. Set RESEND_API_KEY.");

  const { to, studentName, studentId, loginEmail, password, course, batch } = opts;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Welcome to Vivexa Institute — Your Login Credentials`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #334155;">
        <div style="background: #0f172a; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">Vivexa Institute of Technology</h1>
          <p style="margin: 8px 0 0; opacity: 0.85; font-size: 14px;">Your student account has been created</p>
        </div>
        <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Dear <strong>${studentName}</strong>,</p>
          <p>Welcome to Vivexa Institute of Technology. Use the credentials below to log in to the <strong>Vivexa Learn</strong> mobile app.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px 0; color: #64748b;">Student ID</td><td style="padding: 8px 0; font-weight: 600;">${studentId}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Login Email</td><td style="padding: 8px 0; font-weight: 600;">${loginEmail}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Password</td><td style="padding: 8px 0; font-weight: 600; font-family: monospace;">${password}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Course</td><td style="padding: 8px 0;">${course}</td></tr>
            ${batch ? `<tr><td style="padding: 8px 0; color: #64748b;">Batch</td><td style="padding: 8px 0;">${batch}</td></tr>` : ""}
          </table>
          <p style="font-size: 13px; color: #64748b;">Please change your password after first login. For support call +91 9582194338.</p>
          <p style="margin-top: 24px;">Regards,<br><strong>Vivexa Institute of Technology</strong><br>Gurugram, Haryana</p>
        </div>
      </div>
    `,
  });
}

export async function sendFeeReceiptEmail(opts: {
  to: string;
  studentName: string;
  receiptHtml: string;
  receiptNo: string;
}) {
  if (!resend) throw new Error("Resend API is not configured. Set RESEND_API_KEY.");

  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Fee Receipt ${opts.receiptNo} — Vivexa Institute`,
    html: opts.receiptHtml,
  });
}

export async function sendAdmissionEnquiryEmail(opts: {
  fullName: string;
  phone: string;
  email?: string;
  course: string;
  message?: string;
  fatherName?: string;
  dob?: string;
  gender?: string;
  qualification?: string;
  address?: string;
}) {
  if (!resend) throw new Error("Resend API is not configured.");

  const instituteEmail = process.env.INSTITUTE_EMAIL || "contact@vivexatech.in";

  await resend.emails.send({
    from: FROM,
    to: instituteEmail,
    subject: `New Admission Enquiry: ${opts.fullName} — ${opts.course}`,
    html: `
      <h2>New Website Admission Enquiry</h2>
      <p><strong>Name:</strong> ${opts.fullName}</p>
      <p><strong>Phone:</strong> ${opts.phone}</p>
      <p><strong>Email:</strong> ${opts.email || "Not provided"}</p>
      <p><strong>Course:</strong> ${opts.course}</p>
      ${opts.fatherName ? `<p><strong>Father's Name:</strong> ${opts.fatherName}</p>` : ""}
      ${opts.dob ? `<p><strong>DOB:</strong> ${opts.dob}</p>` : ""}
      ${opts.gender ? `<p><strong>Gender:</strong> ${opts.gender}</p>` : ""}
      ${opts.qualification ? `<p><strong>Qualification:</strong> ${opts.qualification}</p>` : ""}
      ${opts.address ? `<p><strong>Address:</strong> ${opts.address}</p>` : ""}
      ${opts.message ? `<p><strong>Message:</strong> ${opts.message}</p>` : ""}
    `,
  });
}
