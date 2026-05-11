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

export const financeService = {
  async getSplits(params) {
    const response = await httpClient.get("/splits", { params: cleanParams(params) });
    return response.data;
  },

  async createSplit(payload) {
    const response = await httpClient.post("/splits", payload);
    return response.data;
  },

  async updateSplit(id, payload) {
    const response = await httpClient.put(`/splits/${id}`, payload);
    return response.data;
  },

  async updateSplitStatus(id, status) {
    const response = await httpClient.patch(`/splits/${id}/status`, { status });
    return response.data;
  },

  async getSplitHistory(artistId) {
    const response = await httpClient.get(`/splits/history/${artistId}`);
    return response.data;
  },

  async recalculateSplits(payload) {
    const response = await httpClient.post("/splits/recalculate", payload);
    return response.data;
  },

  async getFinanceSummary(params) {
    const response = await httpClient.get("/finance/summary", { params: cleanParams(params) });
    return response.data;
  },

  async getArtistFinance(id = "me", params) {
    const response = await httpClient.get(`/finance/artist/${id}`, { params: cleanParams(params) });
    return response.data;
  },

  async getLabelFinance(id = "me", params) {
    const response = await httpClient.get(`/finance/label/${id}`, { params: cleanParams(params) });
    return response.data;
  },

  async getMonthlyFinance(params) {
    const response = await httpClient.get("/finance/monthly", { params: cleanParams(params) });
    return response.data;
  },

  async recalculateFinance(payload) {
    const response = await httpClient.post("/finance/recalculate", payload);
    return response.data;
  },

  async getArtistStatement(id = "me", params) {
    const response = await httpClient.get(`/statements/artist/${id}`, { params: cleanParams(params) });
    return response.data.statement;
  },

  async getLabelStatement(id = "me", params) {
    const response = await httpClient.get(`/statements/label/${id}`, { params: cleanParams(params) });
    return response.data.statement;
  },

  async exportArtistStatement(id = "me", format = "excel", params = {}) {
    const response = await httpClient.get(`/statements/artist/${id}/export/${format}`, {
      params: cleanParams(params),
      responseType: "blob",
      timeout: 120000,
    });
    downloadBlob(response, `nixa-artist-statement.${format === "pdf" ? "pdf" : "xlsx"}`);
  },

  async exportLabelStatement(id = "me", format = "excel", params = {}) {
    const response = await httpClient.get(`/statements/label/${id}/export/${format}`, {
      params: cleanParams(params),
      responseType: "blob",
      timeout: 120000,
    });
    downloadBlob(response, `nixa-label-statement.${format === "pdf" ? "pdf" : "xlsx"}`);
  },

  async exportFinanceReport(type, format, params = {}) {
    const response = await httpClient.get("/finance/reports/export", {
      params: cleanParams({ ...params, type, format }),
      responseType: "blob",
      timeout: 120000,
    });
    downloadBlob(response, `nixa-finance-${type}.${format}`);
  },
};
