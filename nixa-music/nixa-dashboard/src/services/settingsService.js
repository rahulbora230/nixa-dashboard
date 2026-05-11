import httpClient from "./httpClient";

export const settingsService = {
  async getSettings() {
    const { data } = await httpClient.get("/settings");
    return data.data || data;
  },

  async updateSettings(payload) {
    const { data } = await httpClient.put("/settings", payload);
    return data.data || data;
  },
};
