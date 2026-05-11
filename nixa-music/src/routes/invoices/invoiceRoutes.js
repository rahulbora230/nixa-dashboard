const express = require("express");
const { verifyToken } = require("../../middleware/authMiddleware");
const invoiceController = require("../../controllers/invoices/invoiceController");

const router = express.Router();

router.use(verifyToken);

router.post("/generate/:payoutId", invoiceController.generateInvoice);
router.get("/list", invoiceController.listInvoices);
router.get("/export", invoiceController.exportInvoices);
router.get("/download/:id", invoiceController.downloadInvoice);
router.get("/:id", invoiceController.getInvoice);

module.exports = router;
