import httpClient from "./httpClient";

export const notificationService = {
  async getNotifications(params = {}) {
    const { data } = await httpClient.get("/notifications", { params });
    return data.data || data;
  },

  async markRead(id) {
    const { data } = await httpClient.patch(`/notifications/${id}/read`);
    return data.data || data;
  },

  async markAllRead() {
    const { data } = await httpClient.patch("/notifications/read-all");
    return data.data || data;
  },
};
