import httpClient from "./httpClient";

export const artistService = {
  async getArtists(params = {}) {
    const { data } = await httpClient.get("/artists", { params });
    return data;
  },

  async getArtist(id) {
    const { data } = await httpClient.get(`/artists/${id}`);
    return data.artist;
  },

  async createArtist(payload) {
    const { data } = await httpClient.post("/artists", payload);
    return data.artist;
  },

  async updateArtist(id, payload) {
    const { data } = await httpClient.put(`/artists/${id}`, payload);
    return data.artist;
  },

  async updateStatus(id, status) {
    const { data } = await httpClient.patch(`/artists/${id}/status`, { status });
    return data.artist;
  },

  async deleteArtist(id) {
    const { data } = await httpClient.delete(`/artists/${id}`);
    return data.artist;
  },
};
