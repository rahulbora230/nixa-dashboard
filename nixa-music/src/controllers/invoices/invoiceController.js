const invoiceService = require("../../services/invoices/invoiceService");

const forbidden = (res, message = "You do not have permission to access invoices.") =>
  res.status(403).json({ message });

const generateInvoice = async (req, res) => {
  try {
    if (!["admin", "accountant"].includes(req.user.role)) {
      return forbidden(res, "Only admin and accountant roles can generate invoices.");
    }

    const invoice = await invoiceService.generateInvoice({
      user: req.user,
      payoutId: req.params.payoutId,
      payload: req.body,
    });

    return res.status(201).json({ message: "Invoice generated.", invoice });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ message: error.message || "Unable to generate invoice." });
  }
};

const listInvoices = async (req, res) => {
  try {
    const result = await invoiceService.listInvoices({ user: req.user, query: req.query });
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to load invoices." });
  }
};

const getInvoice = async (req, res) => {
  try {
    const invoice = await invoiceService.getInvoiceById({ user: req.user, id: req.params.id });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found." });
    }

    return res.json({ invoice });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to load invoice." });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const result = await invoiceService.getInvoiceDownload({ user: req.user, id: req.params.id });

    if (!result) {
      return res.status(404).json({ message: "Invoice not found." });
    }

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);

    if (result.path) {
      return res.sendFile(result.path);
    }

    return res.send(result.buffer);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to download invoice." });
  }
};

const exportInvoices = async (req, res) => {
  try {
    if (!["admin", "accountant"].includes(req.user.role)) {
      return forbidden(res, "Only admin and accountant roles can export invoice reports.");
    }

    const format = req.query.format === "csv" ? "csv" : "xlsx";
    const result = await invoiceService.exportInvoices({ user: req.user, query: req.query, format });
    const fileName = `nixa-invoices-${new Date().toISOString().slice(0, 10)}.${result.extension}`;

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(result.buffer);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to export invoices." });
  }
};

module.exports = {
  downloadInvoice,
  exportInvoices,
  generateInvoice,
  getInvoice,
  listInvoices,
};
