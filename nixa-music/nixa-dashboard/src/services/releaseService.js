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

export const getAssetUrl = (url) => {
  if (!url) {
    return "";
  }

  if (url.startsWith("http")) {
    return url;
  }

  return `${apiOrigin}${url.startsWith("/") ? url : `/${url}`}`;
};

export const releaseService = {
  async list(params) {
    const response = await httpClient.get(`/releases${toQueryString(params)}`);
    return response.data;
  },

  async getById(id) {
    const response = await httpClient.get(`/releases/${id}`);
    return response.data;
  },

  async getBySlug(slug) {
    const response = await httpClient.get(`/releases/${slug}`);
    return response.data;
  },

  async create(formData) {
    const response = await httpClient.post("/releases", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  async update(id, formData) {
    const response = await httpClient.put(`/releases/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  async updateStatus(id, payload) {
    const response = await httpClient.patch(`/releases/${id}/status`, payload);
    return response.data;
  },

  async requestUpdate(id, payload) {
    const response = await httpClient.patch(`/releases/${id}/request-update`, payload);
    return response.data;
  },

  async submitDraft(id, payload = {}) {
    const response = await httpClient.patch(`/releases/${id}/submit`, payload);
    return response.data;
  },

  async updateMetadata(id, payload) {
    const response = await httpClient.patch(`/releases/${id}/metadata`, payload);
    return response.data;
  },

  async bulkUpdateStatus(payload) {
    const response = await httpClient.post("/releases/bulk/status", payload);
    return response.data;
  },

  async bulkTransferOwnership(payload) {
    const response = await httpClient.post("/releases/bulk/transfer", payload);
    return response.data;
  },

  async getQcDashboard() {
    const response = await httpClient.get("/releases/qc/dashboard");
    return response.data;
  },

  async getQcDetails(id) {
    const response = await httpClient.get(`/releases/qc/${id}`);
    return response.data;
  },

  async runQc(id, payload = {}) {
    const response = await httpClient.post(`/releases/${id}/qc/run`, payload);
    return response.data;
  },

  async bulkRunQc(payload) {
    const response = await httpClient.post("/releases/bulk/qc", payload);
    return response.data;
  },

  async listDeliveryQueue(params = {}) {
    const response = await httpClient.get(`/releases/delivery/queue${toQueryString(params)}`);
    return response.data;
  },

  async queueDelivery(id, payload = {}) {
    const response = await httpClient.post(`/releases/${id}/queue-delivery`, payload);
    return response.data;
  },

  async bulkQueueDelivery(payload) {
    const response = await httpClient.post("/releases/bulk/queue-delivery", payload);
    return response.data;
  },

  async updateDeliveryQueueStatus(queueId, payload) {
    const response = await httpClient.patch(`/releases/delivery/queue/${queueId}/status`, payload);
    return response.data;
  },

  async retryDelivery(releaseId, queueId, payload = {}) {
    const response = await httpClient.post(`/releases/${releaseId}/delivery/${queueId}/retry`, payload);
    return response.data;
  },

  async listTakedowns(params = {}) {
    const response = await httpClient.get(`/releases/takedowns${toQueryString(params)}`);
    return response.data;
  },

  async requestTakedown(id, payload) {
    const response = await httpClient.post(`/releases/${id}/takedown`, payload);
    return response.data;
  },

  async updateTakedownStatus(id, payload) {
    const response = await httpClient.patch(`/releases/takedowns/${id}/status`, payload);
    return response.data;
  },

  async unlockMetadata(id, payload) {
    const response = await httpClient.post(`/releases/${id}/metadata/unlock`, payload);
    return response.data;
  },

  async updateDeliveries(id, payload) {
    const response = await httpClient.post(`/releases/${id}/deliveries`, payload);
    return response.data;
  },

  async deleteDelivery(releaseId, deliveryId) {
    const response = await httpClient.delete(`/releases/${releaseId}/deliveries/${deliveryId}`);
    return response.data;
  },

  async transferOwnership(id, payload) {
    const response = await httpClient.post(`/releases/${id}/transfer-ownership`, payload);
    return response.data;
  },

  async previewMetadataImport(formData) {
    const response = await httpClient.post("/releases/import/metadata/preview", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  async applyMetadataImport(importId) {
    const response = await httpClient.post("/releases/import/metadata/apply", { import_id: importId, importId });
    return response.data;
  },

  async getMetadataFormats() {
    const response = await httpClient.get("/releases/metadata/formats");
    return response.data.data || response.data;
  },

  async listMetadataImports() {
    const response = await httpClient.get("/releases/imports/metadata");
    return response.data;
  },

  async applyDspLinks(importId) {
    const response = await httpClient.post("/releases/import/dsp-links/apply", { import_id: importId });
    return response.data;
  },

  async uploadDailyPlayReport(formData) {
    const response = await httpClient.post("/releases/import/daily-play-report", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  async uploadLiveLinks(formData) {
    const response = await httpClient.post("/releases/import/live-links", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  async uploadReleaseStatus(formData) {
    const response = await httpClient.post("/releases/import/release-status", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  async downloadMetadataTemplate(type = "v1") {
    const response = await httpClient.get(`/releases/templates/metadata/${type}`, {
      responseType: "blob",
    });
    const blobUrl = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `nixa-metadata-template-${type}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  },

  async downloadMetadataErrorReport(importId) {
    const response = await httpClient.get(`/releases/imports/metadata/${importId}/errors`, {
      responseType: "blob",
    });
    const blobUrl = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `metadata-import-errors-${importId}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  },

  async remove(id) {
    const response = await httpClient.delete(`/releases/${id}`);
    return response.data;
  },

  async download(path, filename) {
    const response = await httpClient.get(path.replace(/^\/api/, ""), {
      responseType: "blob",
    });
    const blobUrl = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  },

  async exportCatalog() {
    const response = await httpClient.get("/releases/export/catalog", {
      responseType: "blob",
    });
    const blobUrl = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `nixa-catalog-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  },

  async exportMetadata(type = "full") {
    const response = await httpClient.get(`/releases/export/metadata${toQueryString({ type })}`, {
      responseType: "blob",
    });
    const blobUrl = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `nixa-metadata-${type}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  },
};
