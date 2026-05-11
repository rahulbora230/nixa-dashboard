import httpClient from "./httpClient";

export const profileService = {
  async getMyProfile() {
    const { data } = await httpClient.get("/profile/me");
    return data;
  },

  async updateMyProfile(payload) {
    const { data } = await httpClient.put("/profile/me", payload);
    return data.profile || data;
  },
};
