import httpClient from "./httpClient";

export const activityLogService = {
  async getActivityLogs(params = {}) {
    const { data } = await httpClient.get("/activity-logs", { params });
    return data;
  },
};
