const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const pool = require("../../config/db");
const { canAccessArtist, canAccessLabel } = require("../finance/financeService");
const { ensurePayoutSchema } = require("../payouts/payoutSchema");

const invoiceDir = path.resolve(process.cwd(), "uploads", "invoices");

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const cleanText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
};

const pdfEscape = (value) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const createSimplePdf = (lines) => {
  const content = [
    "BT",
    "/F1 12 Tf",
    "50 790 Td",
    "16 TL",
    ...lines.slice(0, 44).map((line, index) => `${index === 0 ? "" : "T* "}${`(${pdfEscape(line)}) Tj`}`),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf);
};

const mapInvoiceRow = (row) => ({
  id: row.id,
  payoutId: row.payout_id,
  invoiceNumber: row.invoice_number,
  invoicePath: row.invoice_path,
  invoicePeriodStart: row.invoice_period_start,
  invoicePeriodEnd: row.invoice_period_end,
  recipientName: row.recipient_name,
  recipientType: row.recipient_type,
  gstNumber: row.gst_number,
  panNumber: row.pan_number,
  billingAddress: row.billing_address,
  grossAmount: toNumber(row.gross_amount),
  gstDeduction: toNumber(row.gst_deduction),
  tdsDeduction: toNumber(row.tds_deduction),
  netAmount: toNumber(row.net_amount),
  paymentMethod: row.payment_method,
  transactionReference: row.transaction_reference,
  paymentDate: row.payment_date,
  generatedBy: row.generated_by,
  createdAt: row.created_at,
  payoutStatus: row.payout_status,
  artistId: row.artist_id,
  labelId: row.label_id,
});

const invoiceSelect = `
  SELECT
    i.*,
    p.artist_id,
    p.label_id,
    p.status AS payout_status,
    COALESCE(i.recipient_name, a.artist_name, l.label_name, 'Unknown recipient') AS recipient_name
  FROM invoices i
  LEFT JOIN payouts p ON p.id = i.payout_id
  LEFT JOIN artists a ON a.id = p.artist_id
  LEFT JOIN labels l ON l.id = p.label_id
`;

const canReadInvoice = async (client, user, invoice) => {
  if (["admin", "accountant"].includes(user.role)) {
    return true;
  }

  if (invoice.artistId) {
    return canAccessArtist(client, user, invoice.artistId);
  }

  if (invoice.labelId) {
    return canAccessLabel(client, user, invoice.labelId);
  }

  return false;
};

const getInvoiceNumber = async (client) => {
  const year = new Date().getFullYear();
  const result = await client.query(
    `
    SELECT COUNT(*)::int AS count
    FROM invoices
    WHERE invoice_number LIKE $1
    `,
    [`NIXA-${year}-%`]
  );
  const next = Number(result.rows[0]?.count || 0) + 1;
  return `NIXA-${year}-${String(next).padStart(6, "0")}`;
};

const getPayoutForInvoice = async (client, payoutId) => {
  const result = await client.query(
    `
    SELECT
      p.*,
      CASE WHEN p.artist_id IS NOT NULL THEN 'artist' ELSE 'label' END AS recipient_type,
      COALESCE(a.artist_name, l.label_name, 'Unknown recipient') AS recipient_name
    FROM payouts p
    LEFT JOIN artists a ON a.id = p.artist_id
    LEFT JOIN labels l ON l.id = p.label_id
    WHERE p.id = $1
    LIMIT 1
    `,
    [payoutId]
  );

  return result.rows[0] || null;
};

const buildInvoicePdf = ({ invoice, payout }) => {
  const lines = [
    "Nixa Music Royalty Payout Invoice",
    `Invoice number: ${invoice.invoice_number}`,
    `Recipient: ${invoice.recipient_name}`,
    `Recipient type: ${invoice.recipient_type}`,
    `GST number: ${invoice.gst_number || "Not provided"}`,
    `PAN number: ${invoice.pan_number || "Not provided"}`,
    `Address: ${invoice.billing_address || "Not provided"}`,
    `Revenue period: ${invoice.invoice_period_start || "All"} to ${invoice.invoice_period_end || "Current"}`,
    `Gross revenue: INR ${toNumber(invoice.gross_amount).toLocaleString("en-IN")}`,
    `GST deduction: INR ${toNumber(invoice.gst_deduction).toLocaleString("en-IN")}`,
    `TDS deduction: INR ${toNumber(invoice.tds_deduction).toLocaleString("en-IN")}`,
    `Net payable: INR ${toNumber(invoice.net_amount).toLocaleString("en-IN")}`,
    `Payment method: ${invoice.payment_method || "Not set"}`,
    `Transaction reference: ${invoice.transaction_reference || "Not set"}`,
    `Payment date: ${invoice.payment_date || payout.payout_date || "Not set"}`,
    "",
    "This invoice was generated from Nixa Music payout records.",
  ];

  return createSimplePdf(lines);
};

const generateInvoice = async ({ user, payoutId, payload = {} }) => {
  await ensurePayoutSchema();

  if (!["admin", "accountant"].includes(user.role)) {
    const error = new Error("Only admin and accountant roles can generate invoices.");
    error.statusCode = 403;
    throw error;
  }

  fs.mkdirSync(invoiceDir, { recursive: true });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const payout = await getPayoutForInvoice(client, payoutId);

    if (!payout) {
      const error = new Error("Payout not found.");
      error.statusCode = 404;
      throw error;
    }

    const existing = await client.query(`${invoiceSelect} WHERE i.payout_id = $1 LIMIT 1`, [payoutId]);

    if (existing.rows[0]) {
      await client.query("COMMIT");
      return mapInvoiceRow(existing.rows[0]);
    }

    const invoiceNumber = await getInvoiceNumber(client);
    const relativePath = path.join("uploads", "invoices", `${invoiceNumber}.pdf`).replace(/\\/g, "/");
    const invoiceValues = {
      invoice_number: invoiceNumber,
      recipient_name: cleanText(payload.recipientName || payload.recipient_name) || payout.recipient_name,
      recipient_type: payout.recipient_type,
      gst_number: cleanText(payload.gstNumber || payload.gst_number),
      pan_number: cleanText(payload.panNumber || payload.pan_number),
      billing_address: cleanText(payload.billingAddress || payload.billing_address),
      gross_amount: toNumber(payout.gross_amount),
      gst_deduction: toNumber(payout.gst_deduction),
      tds_deduction: toNumber(payout.tds_deduction),
      net_amount: toNumber(payout.net_amount),
      payment_method: payout.payment_method,
      transaction_reference: payout.transaction_reference,
      payment_date: payout.payout_date,
    };

    const insert = await client.query(
      `
      INSERT INTO invoices (
        payout_id,
        invoice_number,
        invoice_path,
        invoice_period_start,
        invoice_period_end,
        generated_by,
        recipient_name,
        recipient_type,
        gst_number,
        pan_number,
        billing_address,
        gross_amount,
        gst_deduction,
        tds_deduction,
        net_amount,
        payment_method,
        transaction_reference,
        payment_date
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *
      `,
      [
        payoutId,
        invoiceNumber,
        relativePath,
        payload.invoicePeriodStart || payload.invoice_period_start || null,
        payload.invoicePeriodEnd || payload.invoice_period_end || null,
        isUuid(user.id) ? user.id : null,
        invoiceValues.recipient_name,
        invoiceValues.recipient_type,
        invoiceValues.gst_number,
        invoiceValues.pan_number,
        invoiceValues.billing_address,
        invoiceValues.gross_amount,
        invoiceValues.gst_deduction,
        invoiceValues.tds_deduction,
        invoiceValues.net_amount,
        invoiceValues.payment_method,
        invoiceValues.transaction_reference,
        invoiceValues.payment_date,
      ]
    );

    const invoiceRow = { ...insert.rows[0], ...invoiceValues };
    const pdf = buildInvoicePdf({ invoice: invoiceRow, payout });
    fs.writeFileSync(path.resolve(process.cwd(), relativePath), pdf);

    await client.query("COMMIT");
    return mapInvoiceRow({ ...invoiceRow, artist_id: payout.artist_id, label_id: payout.label_id, payout_status: payout.status });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const listInvoices = async ({ user, query = {}, exportMode = false }) => {
  await ensurePayoutSchema();
  const client = await pool.connect();

  try {
    const values = [];
    const conditions = [];
    const addValue = (value) => {
      values.push(value);
      return `$${values.length}`;
    };

    if (user.role === "artist") {
      const artistResult = await client.query("SELECT id FROM artists WHERE user_id = $1 LIMIT 1", [user.id]);
      const artistId = artistResult.rows[0]?.id;
      conditions.push(artistId ? `p.artist_id = ${addValue(artistId)}` : "FALSE");
    }

    if (user.role === "label") {
      const labelResult = await client.query("SELECT id FROM labels WHERE user_id = $1 LIMIT 1", [user.id]);
      const labelId = labelResult.rows[0]?.id;
      conditions.push(labelId ? `p.label_id = ${addValue(labelId)}` : "FALSE");
    }

    if (query.search) {
      const term = `%${String(query.search).trim()}%`;
      const placeholder = addValue(term);
      conditions.push(`
        (
          i.invoice_number ILIKE ${placeholder}
          OR i.recipient_name ILIKE ${placeholder}
          OR i.transaction_reference ILIKE ${placeholder}
        )
      `);
    }

    const page = Math.max(Number.parseInt(query.page || "1", 10), 1);
    const limit = exportMode ? 50000 : Math.min(Math.max(Number.parseInt(query.limit || "12", 10), 1), 100);
    const offset = (page - 1) * limit;
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await client.query(
      `
      ${invoiceSelect}
      ${where}
      ORDER BY i.created_at DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
      `,
      [...values, limit, offset]
    );
    const count = await client.query(
      `
      SELECT COUNT(*)::int AS total
      FROM invoices i
      LEFT JOIN payouts p ON p.id = i.payout_id
      ${where}
      `,
      values
    );
    const total = Number(count.rows[0]?.total || 0);

    return {
      invoices: result.rows.map(mapInvoiceRow),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  } finally {
    client.release();
  }
};

const getInvoiceById = async ({ user, id }) => {
  await ensurePayoutSchema();
  const client = await pool.connect();

  try {
    const result = await client.query(`${invoiceSelect} WHERE i.id = $1 LIMIT 1`, [id]);
    const invoice = result.rows[0] ? mapInvoiceRow(result.rows[0]) : null;

    if (!invoice) {
      return null;
    }

    if (!(await canReadInvoice(client, user, invoice))) {
      const error = new Error("You can only view invoices assigned to your profile.");
      error.statusCode = 403;
      throw error;
    }

    return invoice;
  } finally {
    client.release();
  }
};

const getInvoiceDownload = async ({ user, id }) => {
  const invoice = await getInvoiceById({ user, id });

  if (!invoice) {
    return null;
  }

  const resolvedPath = invoice.invoicePath ? path.resolve(process.cwd(), invoice.invoicePath) : null;
  const safeRoot = path.resolve(process.cwd(), "uploads", "invoices");

  if (!resolvedPath || !resolvedPath.startsWith(safeRoot) || !fs.existsSync(resolvedPath)) {
    const pdf = buildInvoicePdf({ invoice: invoice, payout: { payout_date: invoice.paymentDate } });
    return {
      fileName: `${invoice.invoiceNumber}.pdf`,
      contentType: "application/pdf",
      buffer: pdf,
    };
  }

  return {
    fileName: path.basename(resolvedPath),
    contentType: "application/pdf",
    path: resolvedPath,
  };
};

const exportInvoices = async ({ user, query = {}, format = "xlsx" }) => {
  const { invoices } = await listInvoices({ user, query, exportMode: true });
  const rows = invoices.map((invoice) => ({
    "Invoice Number": invoice.invoiceNumber,
    Recipient: invoice.recipientName,
    Type: invoice.recipientType,
    "Gross Amount": invoice.grossAmount,
    GST: invoice.gstDeduction,
    TDS: invoice.tdsDeduction,
    "Net Amount": invoice.netAmount,
    "Payment Method": invoice.paymentMethod,
    "Transaction Reference": invoice.transactionReference,
    "Payment Date": invoice.paymentDate,
    Created: invoice.createdAt,
  }));

  if (format === "csv") {
    const headers = Object.keys(rows[0] || { "Invoice Number": "" });
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");

    return {
      contentType: "text/csv",
      extension: "csv",
      buffer: Buffer.from(csv),
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Invoices");

  return {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
  };
};

module.exports = {
  exportInvoices,
  generateInvoice,
  getInvoiceById,
  getInvoiceDownload,
  listInvoices,
};
