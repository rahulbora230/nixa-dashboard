import httpClient from "./httpClient";

export const labelService = {
  async getLabels(params = {}) {
    const { data } = await httpClient.get("/labels", { params });
    return data;
  },

  async getLabel(id) {
    const { data } = await httpClient.get(`/labels/${id}`);
    return data.label;
  },

  async createLabel(payload) {
    const { data } = await httpClient.post("/labels", payload);
    return data.label;
  },

  async updateLabel(id, payload) {
    const { data } = await httpClient.put(`/labels/${id}`, payload);
    return data.label;
  },

  async updateStatus(id, status) {
    const { data } = await httpClient.patch(`/labels/${id}/status`, { status });
    return data.label;
  },

  async deleteLabel(id) {
    const { data } = await httpClient.delete(`/labels/${id}`);
    return data.label;
  },

  async assignArtist(labelId, artistId) {
    const { data } = await httpClient.post(`/labels/${labelId}/artists/${artistId}`);
    return data.artists;
  },

  async removeArtist(labelId, artistId) {
    const { data } = await httpClient.delete(`/labels/${labelId}/artists/${artistId}`);
    return data.artists;
  },

  async getLabelArtists(labelId) {
    const { data } = await httpClient.get(`/labels/${labelId}/artists`);
    return data.artists;
  },
};
