const managementService = require("../../services/management/managementService");

const sendError = (res, error, fallback = "Request failed.") => {
  const status = error.statusCode || (error.message?.includes("required") || error.message?.includes("Invalid") ? 400 : 500);
  return res.status(status).json({ message: error.message || fallback });
};

const listLabels = async (req, res) => {
  try {
    const result = await managementService.listLabels({ query: req.query, user: req.user });
    return res.json(result);
  } catch (error) {
    return sendError(res, error, "Unable to load labels.");
  }
};

const getLabel = async (req, res) => {
  try {
    const label = await managementService.getLabelById(req.params.id, { user: req.user });

    if (!label) {
      return res.status(404).json({ message: "Label not found." });
    }

    return res.json({ label });
  } catch (error) {
    return sendError(res, error, "Unable to load label.");
  }
};

const createLabel = async (req, res) => {
  try {
    const label = await managementService.createLabel({ payload: req.body, user: req.user });
    return res.status(201).json({ message: "Label created successfully.", label });
  } catch (error) {
    return sendError(res, error, "Unable to create label.");
  }
};

const updateLabel = async (req, res) => {
  try {
    const label = await managementService.updateLabel({ id: req.params.id, payload: req.body, user: req.user });

    if (!label) {
      return res.status(404).json({ message: "Label not found." });
    }

    return res.json({ message: "Label updated successfully.", label });
  } catch (error) {
    return sendError(res, error, "Unable to update label.");
  }
};

const updateLabelStatus = async (req, res) => {
  try {
    const label = await managementService.updateLabelStatus({
      id: req.params.id,
      status: req.body.status,
      user: req.user,
    });

    if (!label) {
      return res.status(404).json({ message: "Label not found." });
    }

    return res.json({ message: "Label status updated.", label });
  } catch (error) {
    return sendError(res, error, "Unable to update label status.");
  }
};

const deleteLabel = async (req, res) => {
  try {
    const label = await managementService.deleteLabel({ id: req.params.id, user: req.user });

    if (!label) {
      return res.status(404).json({ message: "Label not found." });
    }

    return res.json({ message: "Label disabled successfully.", label });
  } catch (error) {
    return sendError(res, error, "Unable to disable label.");
  }
};

const assignArtist = async (req, res) => {
  try {
    const result = await managementService.assignArtistToLabel({
      labelId: req.params.labelId,
      artistId: req.params.artistId,
      user: req.user,
    });

    if (!result) {
      return res.status(404).json({ message: "Artist or label not found." });
    }

    return res.status(201).json({ message: "Artist assigned to label.", ...result });
  } catch (error) {
    return sendError(res, error, "Unable to assign artist.");
  }
};

const removeArtist = async (req, res) => {
  try {
    const result = await managementService.removeArtistFromLabel({
      labelId: req.params.labelId,
      artistId: req.params.artistId,
      user: req.user,
    });

    if (!result) {
      return res.status(404).json({ message: "Active artist assignment not found." });
    }

    return res.json({ message: "Artist removed from label.", ...result });
  } catch (error) {
    return sendError(res, error, "Unable to remove artist.");
  }
};

const listLabelArtists = async (req, res) => {
  try {
    if (req.user?.role === "label") {
      const label = await managementService.getLabelById(req.params.labelId, { user: req.user });

      if (!label) {
        return res.status(404).json({ message: "Label not found." });
      }
    }

    const result = await managementService.getLabelArtists(req.params.labelId);
    return res.json(result);
  } catch (error) {
    return sendError(res, error, "Unable to load label artists.");
  }
};

module.exports = {
  assignArtist,
  createLabel,
  deleteLabel,
  getLabel,
  listLabelArtists,
  listLabels,
  removeArtist,
  updateLabel,
  updateLabelStatus,
};
