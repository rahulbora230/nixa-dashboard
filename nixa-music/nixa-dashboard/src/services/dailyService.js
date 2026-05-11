import httpClient from "./httpClient";

const cleanParams = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== "" && value !== null && value !== undefined));

const downloadBlob = (response, filename) => {
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

export const dailyService = {
  async uploadReport(formData, onUploadProgress) {
    const response = await httpClient.post("/daily-reports/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
      onUploadProgress,
    });

    return response.data;
  },

  async getImports(params) {
    const response = await httpClient.get("/daily-reports/imports", {
      params: cleanParams(params),
    });
    return response.data;
  },

  async getRows(params) {
    const response = await httpClient.get("/daily-reports/list", {
      params: cleanParams(params),
    });
    return response.data;
  },

  async getUnmatched(params) {
    const response = await httpClient.get("/daily-reports/unmatched", {
      params: cleanParams(params),
    });
    return response.data;
  },

  async getOverview(params) {
    const response = await httpClient.get("/daily-analytics/overview", {
      params: cleanParams(params),
    });
    return response.data;
  },

  async getTrack(id, params) {
    const response = await httpClient.get(`/daily-analytics/track/${id}`, {
      params: cleanParams(params),
    });
    return response.data;
  },

  async getRelease(id, params) {
    const response = await httpClient.get(`/daily-analytics/release/${id}`, {
      params: cleanParams(params),
    });
    return response.data;
  },

  async getArtist(id = "me", params) {
    const response = await httpClient.get(`/daily-analytics/artist/${id}`, {
      params: cleanParams(params),
    });
    return response.data;
  },

  async getLabel(id = "me", params) {
    const response = await httpClient.get(`/daily-analytics/label/${id}`, {
      params: cleanParams(params),
    });
    return response.data;
  },

  async getTrending(params) {
    const response = await httpClient.get("/daily-analytics/trending", {
      params: cleanParams(params),
    });
    return response.data;
  },

  async exportAnalytics({ type = "daily", format = "xlsx", params = {}, filename }) {
    const response = await httpClient.get("/daily-analytics/export", {
      params: cleanParams({ ...params, type, format }),
      responseType: "blob",
      timeout: 120000,
    });
    downloadBlob(response, filename || `nixa-daily-${type}.${format}`);
  },
};
