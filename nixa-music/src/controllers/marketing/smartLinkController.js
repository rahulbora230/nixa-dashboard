const {
  addPlatform,
  createPreSaveCampaign,
  createSmartLink,
  deletePlatform,
  deleteSmartLink,
  getMarketingOverview,
  getPreSaveCampaignBySlug,
  getPromoKit,
  getPublicArtistPage,
  getPublicReleasePage,
  getSmartLinkAnalytics,
  getSmartLinkById,
  getSmartLinkBySlug,
  listSmartLinks,
  recordSmartLinkClick,
  subscribePreSave,
  updatePlatform,
  updateSmartLink,
} = require("../../services/marketing/smartLinkService");

const sendError = (res, error, fallback = "Request failed.") => {
  const status = error.status || error.statusCode || 500;
  if (status >= 500) {
    console.error("Smart link controller error:", error);
  }

  return res.status(status).json({ message: error.message || fallback });
};

const create = async (req, res) => {
  try {
    const smartLink = await createSmartLink(req.user, req.body);
    return res.status(201).json({ smartLink });
  } catch (error) {
    return sendError(res, error, "Failed to create smart link.");
  }
};

const list = async (req, res) => {
  try {
    const data = await listSmartLinks(req.user, req.query);
    return res.json(data);
  } catch (error) {
    return sendError(res, error, "Failed to load smart links.");
  }
};

const getById = async (req, res) => {
  try {
    const smartLink = await getSmartLinkById(req.user, req.params.id);
    return res.json({ smartLink });
  } catch (error) {
    return sendError(res, error, "Failed to load smart link.");
  }
};

const getBySlug = async (req, res) => {
  try {
    const smartLink = await getSmartLinkBySlug(req.params.slug);
    return res.json({ smartLink });
  } catch (error) {
    return sendError(res, error, "Smart link not found.");
  }
};

const update = async (req, res) => {
  try {
    const smartLink = await updateSmartLink(req.user, req.params.id, req.body);
    return res.json({ smartLink });
  } catch (error) {
    return sendError(res, error, "Failed to update smart link.");
  }
};

const remove = async (req, res) => {
  try {
    const result = await deleteSmartLink(req.user, req.params.id);
    return res.json({ message: "Smart link archived.", smartLink: result });
  } catch (error) {
    return sendError(res, error, "Failed to delete smart link.");
  }
};

const addPlatformButton = async (req, res) => {
  try {
    const platforms = await addPlatform(req.user, req.params.id, req.body);
    return res.status(201).json({ platforms });
  } catch (error) {
    return sendError(res, error, "Failed to add platform.");
  }
};

const updatePlatformButton = async (req, res) => {
  try {
    const platforms = await updatePlatform(req.user, req.params.id, req.params.platformId, req.body);
    return res.json({ platforms });
  } catch (error) {
    return sendError(res, error, "Failed to update platform.");
  }
};

const removePlatformButton = async (req, res) => {
  try {
    const platforms = await deletePlatform(req.user, req.params.id, req.params.platformId);
    return res.json({ platforms });
  } catch (error) {
    return sendError(res, error, "Failed to delete platform.");
  }
};

const click = async (req, res) => {
  try {
    const result = await recordSmartLinkClick(req.params.slug, req.body, req);
    return res.json(result);
  } catch (error) {
    return sendError(res, error, "Failed to track smart link click.");
  }
};

const analytics = async (req, res) => {
  try {
    const data = await getSmartLinkAnalytics(req.user, req.params.id, req.query);
    return res.json(data);
  } catch (error) {
    return sendError(res, error, "Failed to load smart link analytics.");
  }
};

const overview = async (req, res) => {
  try {
    const data = await getMarketingOverview(req.user, req.query);
    return res.json(data);
  } catch (error) {
    return sendError(res, error, "Failed to load marketing analytics.");
  }
};

const publicRelease = async (req, res) => {
  try {
    const data = await getPublicReleasePage(req.params.releaseSlug, req.params.trackSlug);
    return res.json(data);
  } catch (error) {
    return sendError(res, error, "Public release not found.");
  }
};

const publicArtist = async (req, res) => {
  try {
    const data = await getPublicArtistPage(req.params.artistSlug);
    return res.json(data);
  } catch (error) {
    return sendError(res, error, "Public artist not found.");
  }
};

const promoKit = async (req, res) => {
  try {
    const data = await getPromoKit(req.user, req.params.releaseId);
    return res.json(data);
  } catch (error) {
    return sendError(res, error, "Failed to load promo kit.");
  }
};

const createPreSave = async (req, res) => {
  try {
    const campaign = await createPreSaveCampaign(req.user, req.body);
    return res.status(201).json({ campaign });
  } catch (error) {
    return sendError(res, error, "Failed to create pre-save campaign.");
  }
};

const getPreSave = async (req, res) => {
  try {
    const campaign = await getPreSaveCampaignBySlug(req.params.slug);
    return res.json({ campaign });
  } catch (error) {
    return sendError(res, error, "Pre-save campaign not found.");
  }
};

const subscribe = async (req, res) => {
  try {
    const subscriber = await subscribePreSave(req.params.slug, req.body);
    return res.status(201).json({ subscriber, message: "Pre-save interest captured." });
  } catch (error) {
    return sendError(res, error, "Failed to capture pre-save interest.");
  }
};

module.exports = {
  addPlatformButton,
  analytics,
  click,
  create,
  createPreSave,
  getById,
  getBySlug,
  getPreSave,
  list,
  overview,
  promoKit,
  publicArtist,
  publicRelease,
  remove,
  removePlatformButton,
  subscribe,
  update,
  updatePlatformButton,
};
