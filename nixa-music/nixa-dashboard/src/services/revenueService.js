import httpClient from "./httpClient";

const cleanParams = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== "" && value !== null && value !== undefined));

export const revenueService = {
  async uploadRevenue(formData, onUploadProgress) {
    const response = await httpClient.post("/revenue/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
      onUploadProgress,
    });

    return response.data;
  },

  async getImports(params) {
    const response = await httpClient.get("/revenue/imports", {
      params: cleanParams(params),
    });

    return response.data;
  },

  async getRevenueList(params) {
    const response = await httpClient.get("/revenue/list", {
      params: cleanParams(params),
    });

    return response.data;
  },

  async getAnalytics(params) {
    const response = await httpClient.get("/revenue/analytics", {
      params: cleanParams(params),
    });

    return response.data;
  },

  async recalculate(payload) {
    const response = await httpClient.post("/revenue/recalculate", payload);
    return response.data;
  },

  async exportRevenue(format, params) {
    const response = await httpClient.get("/revenue/export", {
      params: cleanParams({ ...params, format }),
      responseType: "blob",
      timeout: 120000,
    });

    return response;
  },
};
