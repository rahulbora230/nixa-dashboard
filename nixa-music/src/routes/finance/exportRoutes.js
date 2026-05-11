const express = require("express");
const XLSX = require("xlsx");
const pool = require("../../config/db");
const { verifyToken, onlyAdmin } = require("../../middleware/authMiddleware");
const { ensureFinanceSchema } = require("../../services/finance/financeSchema");

const router = express.Router();

// Helper function to convert data to CSV
const convertToCSV = (data) => {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = data.map(row => 
    headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(',')
  );
  
  return [headers.join(','), ...csvRows].join('\n');
};

// Helper function to format currency
const formatCurrency = (amount) => {
  return parseFloat(amount || 0).toFixed(2);
};

// GET /api/finance/export/summary - Export finance summary
router.get("/summary", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const { format = "xlsx", reportMonth, platform } = req.query;
    
    // Build WHERE clause
    let whereClause = "WHERE 1=1";
    let queryParams = [];
    let paramCount = 1;
    
    if (reportMonth) {
      whereClause += ` AND cr.report_month = $${paramCount}`;
      queryParams.push(reportMonth);
      paramCount++;
    }
    
    if (platform) {
      whereClause += ` AND rr.platform = $${paramCount}`;
      queryParams.push(platform);
      paramCount++;
    }
    
    // Add role-based filtering
    if (req.user.role === 'artist') {
      whereClause += ` AND cr.user_id = $${paramCount}`;
      queryParams.push(req.user.id);
      paramCount++;
    } else if (req.user.role === 'label') {
      whereClause += ` AND (
        cr.user_id IN (SELECT id FROM users WHERE label_id = $${paramCount}) OR
        cr.label_id = $${paramCount}
      )`;
      queryParams.push(req.user.id, req.user.id);
      paramCount += 2;
    }

    const result = await client.query(`
      SELECT 
        cr.report_month,
        rr.platform,
        COUNT(*) as revenue_count,
        SUM(cr.gross_revenue) as gross_revenue,
        SUM(cr.artist_share) as artist_share,
        SUM(cr.label_share) as label_share,
        SUM(cr.company_share) as company_share,
        SUM(cr.payable_amount) as payable_amount,
        SUM(CASE WHEN cr.status = 'calculated' THEN cr.payable_amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN cr.status = 'paid' THEN cr.payable_amount ELSE 0 END) as paid_amount
      FROM calculated_revenues cr
      LEFT JOIN raw_revenues rr ON cr.raw_revenue_id = rr.id
      ${whereClause}
      GROUP BY cr.report_month, rr.platform
      ORDER BY cr.report_month DESC, rr.platform
    `, queryParams);

    const exportData = result.rows.map(row => ({
      'Report Month': row.report_month,
      'Platform': row.platform,
      'Revenue Count': row.revenue_count,
      'Gross Revenue': formatCurrency(row.gross_revenue),
      'Artist Share': formatCurrency(row.artist_share),
      'Label Share': formatCurrency(row.label_share),
      'Company Share': formatCurrency(row.company_share),
      'Payable Amount': formatCurrency(row.payable_amount),
      'Pending Amount': formatCurrency(row.pending_amount),
      'Paid Amount': formatCurrency(row.paid_amount)
    }));

    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Finance Summary");

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=finance_summary_export.xlsx");
      res.send(buffer);
    } else if (format === 'csv') {
      const csv = convertToCSV(exportData);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=finance_summary_export.csv");
      res.send(csv);
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid export format. Use 'xlsx' or 'csv'."
      });
    }
  } catch (error) {
    console.error("Export finance summary error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to export finance summary"
    });
  } finally {
    client.release();
  }
});

// GET /api/finance/export/detailed - Export detailed revenue data
router.get("/detailed", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const { format = "xlsx", reportMonth, platform, artistId, labelId } = req.query;
    
    // Build WHERE clause
    let whereClause = "WHERE 1=1";
    let queryParams = [];
    let paramCount = 1;
    
    if (reportMonth) {
      whereClause += ` AND cr.report_month = $${paramCount}`;
      queryParams.push(reportMonth);
      paramCount++;
    }
    
    if (platform) {
      whereClause += ` AND rr.platform = $${paramCount}`;
      queryParams.push(platform);
      paramCount++;
    }
    
    if (artistId) {
      whereClause += ` AND cr.artist_id = $${paramCount}`;
      queryParams.push(artistId);
      paramCount++;
    }
    
    if (labelId) {
      whereClause += ` AND cr.label_id = $${paramCount}`;
      queryParams.push(labelId);
      paramCount++;
    }
    
    // Add role-based filtering
    if (req.user.role === 'artist') {
      whereClause += ` AND cr.user_id = $${paramCount}`;
      queryParams.push(req.user.id);
      paramCount++;
    } else if (req.user.role === 'label') {
      whereClause += ` AND (
        cr.user_id IN (SELECT id FROM users WHERE label_id = $${paramCount}) OR
        cr.label_id = $${paramCount}
      )`;
      queryParams.push(req.user.id, req.user.id);
      paramCount += 2;
    }

    const result = await client.query(`
      SELECT 
        cr.report_month,
        rr.platform,
        rr.country,
        rr.isrc,
        rr.track_title,
        rr.artist_name,
        rr.label_name,
        rr.streams,
        cr.gross_revenue,
        cr.artist_share,
        cr.label_share,
        cr.company_share,
        cr.payable_amount,
        cr.status,
        cr.created_at
      FROM calculated_revenues cr
      LEFT JOIN raw_revenues rr ON cr.raw_revenue_id = rr.id
      ${whereClause}
      ORDER BY cr.report_month DESC, rr.platform, rr.track_title
    `, queryParams);

    const exportData = result.rows.map(row => ({
      'Report Month': row.report_month,
      'Platform': row.platform,
      'Country': row.country,
      'ISRC': row.isrc,
      'Track Title': row.track_title,
      'Artist': row.artist_name,
      'Label': row.label_name,
      'Streams': row.streams,
      'Gross Revenue': formatCurrency(row.gross_revenue),
      'Artist Share': formatCurrency(row.artist_share),
      'Label Share': formatCurrency(row.label_share),
      'Company Share': formatCurrency(row.company_share),
      'Payable': formatCurrency(row.payable_amount),
      'Status': row.status,
      'Created At': row.created_at
    }));

    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Detailed Revenue");

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=detailed_revenue_export.xlsx");
      res.send(buffer);
    } else if (format === 'csv') {
      const csv = convertToCSV(exportData);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=detailed_revenue_export.csv");
      res.send(csv);
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid export format. Use 'xlsx' or 'csv'."
      });
    }
  } catch (error) {
    console.error("Export detailed revenue error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to export detailed revenue"
    });
  } finally {
    client.release();
  }
});

// GET /api/finance/export/payouts - Export payout data
router.get("/payouts", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const { format = "xlsx", status, dateFrom, dateTo } = req.query;
    
    // Build WHERE clause
    let whereClause = "WHERE 1=1";
    let queryParams = [];
    let paramCount = 1;
    
    if (status) {
      whereClause += ` AND p.status = $${paramCount}`;
      queryParams.push(status);
      paramCount++;
    }
    
    if (dateFrom) {
      whereClause += ` AND p.created_at >= $${paramCount}`;
      queryParams.push(dateFrom);
      paramCount++;
    }
    
    if (dateTo) {
      whereClause += ` AND p.created_at <= $${paramCount}`;
      queryParams.push(dateTo);
      paramCount++;
    }
    
    // Add role-based filtering
    if (req.user.role === 'artist') {
      whereClause += ` AND (p.user_id = $${paramCount} OR p.artist_id = $${paramCount})`;
      queryParams.push(req.user.id, req.user.id);
      paramCount += 2;
    } else if (req.user.role === 'label') {
      whereClause += ` AND (
        p.user_id IN (SELECT id FROM users WHERE label_id = $${paramCount}) OR
        p.artist_id IN (SELECT id FROM users WHERE label_id = $${paramCount}) OR
        p.label_id = $${paramCount}
      )`;
      queryParams.push(req.user.id, req.user.id, req.user.id);
      paramCount += 3;
    }

    const result = await client.query(`
      SELECT 
        p.id,
        p.amount,
        p.currency,
        p.status,
        p.payment_method,
        p.reference_number,
        p.remarks,
        p.created_at,
        u.name as created_by_name,
        user.name as user_name,
        artist.name as artist_name,
        label.name as label_name
      FROM payouts p
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN users user ON p.user_id = user.id
      LEFT JOIN users artist ON p.artist_id = artist.id
      LEFT JOIN users label ON p.label_id = label.id
      ${whereClause}
      ORDER BY p.created_at DESC
    `, queryParams);

    const exportData = result.rows.map(row => ({
      'Payout ID': row.id,
      'Amount': formatCurrency(row.amount),
      'Currency': row.currency,
      'Status': row.status,
      'Payment Method': row.payment_method,
      'Reference Number': row.reference_number,
      'Remarks': row.remarks,
      'Created By': row.created_by_name,
      'User': row.user_name,
      'Artist': row.artist_name,
      'Label': row.label_name,
      'Created At': row.created_at
    }));

    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Payouts");

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=payouts_export.xlsx");
      res.send(buffer);
    } else if (format === 'csv') {
      const csv = convertToCSV(exportData);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=payouts_export.csv");
      res.send(csv);
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid export format. Use 'xlsx' or 'csv'."
      });
    }
  } catch (error) {
    console.error("Export payouts error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to export payouts"
    });
  } finally {
    client.release();
  }
});

// GET /api/finance/export/unmatched - Export unmatched revenue data
router.get("/unmatched", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const { format = "xlsx", status = 'unmatched', platform, reportMonth } = req.query;
    
    // Build WHERE clause
    let whereClause = "WHERE ur.status = $1";
    let queryParams = [status];
    let paramCount = 2;
    
    if (platform) {
      whereClause += ` AND ur.platform = $${paramCount}`;
      queryParams.push(platform);
      paramCount++;
    }
    
    if (reportMonth) {
      whereClause += ` AND ur.report_month = $${paramCount}`;
      queryParams.push(reportMonth);
      paramCount++;
    }
    
    // Add role-based filtering
    if (req.user.role === 'artist') {
      whereClause += ` AND ur.artist_name = (SELECT name FROM users WHERE id = $${paramCount})`;
      queryParams.push(req.user.id);
      paramCount++;
    } else if (req.user.role === 'label') {
      whereClause += ` AND (
        ur.artist_name IN (SELECT name FROM users WHERE label_id = $${paramCount}) OR
        ur.label_name = (SELECT name FROM users WHERE id = $${paramCount})
      )`;
      queryParams.push(req.user.id, req.user.id);
      paramCount += 2;
    }

    const result = await client.query(`
      SELECT 
        ur.id,
        ur.isrc,
        ur.track_title,
        ur.artist_name,
        ur.label_name,
        ur.platform,
        ur.country,
        ur.report_month,
        ur.streams,
        ur.revenue,
        ur.currency,
        ur.status,
        ur.notes,
        ur.created_at,
        ur.updated_at
      FROM unmatched_revenues ur
      ${whereClause}
      ORDER BY ur.created_at DESC
    `, queryParams);

    const exportData = result.rows.map(row => ({
      'Unmatched ID': row.id,
      'ISRC': row.isrc,
      'Track Title': row.track_title,
      'Artist': row.artist_name,
      'Label': row.label_name,
      'Platform': row.platform,
      'Country': row.country,
      'Report Month': row.report_month,
      'Streams': row.streams,
      'Revenue': formatCurrency(row.revenue),
      'Currency': row.currency,
      'Status': row.status,
      'Notes': row.notes,
      'Created At': row.created_at,
      'Updated At': row.updated_at
    }));

    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Unmatched Revenue");

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=unmatched_revenue_export.xlsx");
      res.send(buffer);
    } else if (format === 'csv') {
      const csv = convertToCSV(exportData);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=unmatched_revenue_export.csv");
      res.send(csv);
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid export format. Use 'xlsx' or 'csv'."
      });
    }
  } catch (error) {
    console.error("Export unmatched revenue error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to export unmatched revenue"
    });
  } finally {
    client.release();
  }
});

module.exports = router;
