const statementService = require("../../services/finance/statementService");

const getArtistStatement = async (req, res) => {
  try {
    const statement = await statementService.getArtistStatement({
      user: req.user,
      artistId: req.params.id,
      query: req.query,
    });

    return res.json({ statement });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to load artist statement." });
  }
};

const getLabelStatement = async (req, res) => {
  try {
    const statement = await statementService.getLabelStatement({
      user: req.user,
      labelId: req.params.id,
      query: req.query,
    });

    return res.json({ statement });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to load label statement." });
  }
};

const exportArtistStatement = async (req, res, format) => {
  try {
    const statement = await statementService.getArtistStatement({
      user: req.user,
      artistId: req.params.id,
      query: req.query,
    });
    const result =
      format === "pdf" ? statementService.exportStatementPdf(statement) : statementService.exportStatementExcel(statement);

    res.setHeader("Content-Type", result.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="nixa-artist-statement-${new Date().toISOString().slice(0, 10)}.${result.extension}"`
    );
    return res.send(result.buffer);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to export artist statement." });
  }
};

const exportLabelStatement = async (req, res, format) => {
  try {
    const statement = await statementService.getLabelStatement({
      user: req.user,
      labelId: req.params.id,
      query: req.query,
    });
    const result =
      format === "pdf" ? statementService.exportStatementPdf(statement) : statementService.exportStatementExcel(statement);

    res.setHeader("Content-Type", result.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="nixa-label-statement-${new Date().toISOString().slice(0, 10)}.${result.extension}"`
    );
    return res.send(result.buffer);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to export label statement." });
  }
};

module.exports = {
  exportArtistStatement,
  exportLabelStatement,
  getArtistStatement,
  getLabelStatement,
};
