import httpClient from "./httpClient";

const apiBase = httpClient.defaults.baseURL || "http://localhost:5000/api";
const apiOrigin = apiBase.replace(/\/api\/?$/, "");

const toQueryString = (params = {}) => {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, value);
    }
  });

  const query = search.toString();
  return query ? `?${query}` : "";
};

export const getMarketingAssetUrl = (url) => {
  if (!url) {
    return "";
  }

  if (url.startsWith("http") || url.startsWith("data:")) {
    return url;
  }

  return `${apiOrigin}${url.startsWith("/") ? url : `/${url}`}`;
};

export const smartLinkService = {
  async list(params = {}) {
    const response = await httpClient.get(`/smart-links${toQueryString(params)}`);
    return response.data;
  },

  async create(payload) {
    const response = await httpClient.post("/smart-links", payload);
    return response.data;
  },

  async get(id) {
    const response = await httpClient.get(`/smart-links/${id}`);
    return response.data;
  },

  async getBySlug(slug) {
    const response = await httpClient.get(`/smart-links/slug/${slug}`);
    return response.data;
  },

  async update(id, payload) {
    const response = await httpClient.put(`/smart-links/${id}`, payload);
    return response.data;
  },

  async remove(id) {
    const response = await httpClient.delete(`/smart-links/${id}`);
    return response.data;
  },

  async addPlatform(id, payload) {
    const response = await httpClient.post(`/smart-links/${id}/platforms`, payload);
    return response.data;
  },

  async updatePlatform(id, platformId, payload) {
    const response = await httpClient.put(`/smart-links/${id}/platforms/${platformId}`, payload);
    return response.data;
  },

  async removePlatform(id, platformId) {
    const response = await httpClient.delete(`/smart-links/${id}/platforms/${platformId}`);
    return response.data;
  },

  async trackClick(slug, payload) {
    const response = await httpClient.post(`/smart-links/${slug}/click`, payload);
    return response.data;
  },

  async getAnalytics(id, params = {}) {
    const response = await httpClient.get(`/smart-links/${id}/analytics${toQueryString(params)}`);
    return response.data;
  },

  async getOverview(params = {}) {
    const response = await httpClient.get(`/smart-links/analytics/overview${toQueryString(params)}`);
    return response.data;
  },

  async getPromoKit(releaseId) {
    const response = await httpClient.get(`/smart-links/release/${releaseId}/kit`);
    return response.data;
  },

  async getPublicRelease(releaseSlug, trackSlug) {
    const path = trackSlug
      ? `/smart-links/public/release/${releaseSlug}/${trackSlug}`
      : `/smart-links/public/release/${releaseSlug}`;
    const response = await httpClient.get(path);
    return response.data;
  },

  async getPublicArtist(artistSlug) {
    const response = await httpClient.get(`/smart-links/public/artist/${artistSlug}`);
    return response.data;
  },

  async createPreSave(payload) {
    const response = await httpClient.post("/smart-links/pre-save", payload);
    return response.data;
  },

  async getPreSave(slug) {
    const response = await httpClient.get(`/smart-links/pre-save/${slug}`);
    return response.data;
  },

  async subscribePreSave(slug, payload) {
    const response = await httpClient.post(`/smart-links/pre-save/${slug}/subscribe`, payload);
    return response.data;
  },
};

export { toQueryString };
