const managementService = require("../../services/management/managementService");

const sendError = (res, error, fallback = "Request failed.") => {
  const status = error.statusCode || (error.message?.includes("required") || error.message?.includes("Invalid") ? 400 : 500);
  return res.status(status).json({ message: error.message || fallback });
};

const listArtists = async (req, res) => {
  try {
    const result = await managementService.listArtists({ query: req.query, user: req.user });
    return res.json(result);
  } catch (error) {
    return sendError(res, error, "Unable to load artists.");
  }
};

const getArtist = async (req, res) => {
  try {
    const artist = await managementService.getArtistById(req.params.id, { user: req.user });

    if (!artist) {
      return res.status(404).json({ message: "Artist not found." });
    }

    return res.json({ artist });
  } catch (error) {
    return sendError(res, error, "Unable to load artist.");
  }
};

const createArtist = async (req, res) => {
  try {
    const artist = await managementService.createArtist({ payload: req.body, user: req.user });
    return res.status(201).json({ message: "Artist created successfully.", artist });
  } catch (error) {
    return sendError(res, error, "Unable to create artist.");
  }
};

const updateArtist = async (req, res) => {
  try {
    const artist = await managementService.updateArtist({ id: req.params.id, payload: req.body, user: req.user });

    if (!artist) {
      return res.status(404).json({ message: "Artist not found." });
    }

    return res.json({ message: "Artist updated successfully.", artist });
  } catch (error) {
    return sendError(res, error, "Unable to update artist.");
  }
};

const updateArtistStatus = async (req, res) => {
  try {
    const artist = await managementService.updateArtistStatus({
      id: req.params.id,
      status: req.body.status,
      user: req.user,
    });

    if (!artist) {
      return res.status(404).json({ message: "Artist not found." });
    }

    return res.json({ message: "Artist status updated.", artist });
  } catch (error) {
    return sendError(res, error, "Unable to update artist status.");
  }
};

const deleteArtist = async (req, res) => {
  try {
    const artist = await managementService.deleteArtist({ id: req.params.id, user: req.user });

    if (!artist) {
      return res.status(404).json({ message: "Artist not found." });
    }

    return res.json({ message: "Artist disabled successfully.", artist });
  } catch (error) {
    return sendError(res, error, "Unable to disable artist.");
  }
};

module.exports = {
  createArtist,
  deleteArtist,
  getArtist,
  listArtists,
  updateArtist,
  updateArtistStatus,
};
