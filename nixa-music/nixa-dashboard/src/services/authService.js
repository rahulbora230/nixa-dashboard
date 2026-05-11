import httpClient from "./httpClient";

export const authService = {
  async login(credentials) {
    const response = await httpClient.post("/auth/login", credentials);
    return response.data;
  },

  async forgotPassword(email) {
    const response = await httpClient.post("/auth/forgot-password", { email });
    return response.data.data || response.data;
  },

  async resetPassword(payload) {
    const response = await httpClient.post("/auth/reset-password", payload);
    return response.data.data || response.data;
  },
};
