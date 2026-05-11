import httpClient from "./httpClient";

const cleanParams = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== "" && value !== null && value !== undefined));

const downloadBlob = (response, fileName) => {
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(url);
};

export const payoutService = {
  async getDashboard(params) {
    const response = await httpClient.get("/payouts/dashboard", { params: cleanParams(params) });
    return response.data;
  },

  async getPayouts(params) {
    const response = await httpClient.get("/payouts/list", { params: cleanParams(params) });
    return response.data;
  },

  async getPayout(id) {
    const response = await httpClient.get(`/payouts/${id}`);
    return response.data.payout;
  },

  async processPayout(payload) {
    const response = await httpClient.post("/payouts/process", payload);
    return response.data;
  },

  async updateStatus(id, status, notes) {
    const response = await httpClient.patch(`/payouts/${id}/status`, { status, notes });
    return response.data;
  },

  async getArtistPayouts(id = "me", params) {
    const response = await httpClient.get(`/payouts/artist/${id}`, { params: cleanParams(params) });
    return response.data;
  },

  async getLabelPayouts(id = "me", params) {
    const response = await httpClient.get(`/payouts/label/${id}`, { params: cleanParams(params) });
    return response.data;
  },

  async exportPayouts(type, format, params = {}) {
    const response = await httpClient.get("/payouts/export", {
      params: cleanParams({ ...params, type, format }),
      responseType: "blob",
      timeout: 120000,
    });
    downloadBlob(response, `nixa-payouts-${type || "report"}.${format}`);
  },
};
