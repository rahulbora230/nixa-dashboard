import httpClient from "./httpClient";

export const userService = {
  async getUsers(params = {}) {
    const { data } = await httpClient.get("/users", { params });
    return data;
  },

  async getUser(id) {
    const { data } = await httpClient.get(`/users/${id}`);
    return data.user;
  },

  async createUser(payload) {
    const { data } = await httpClient.post("/users", payload);
    return data;
  },

  async updateUser(id, payload) {
    const { data } = await httpClient.put(`/users/${id}`, payload);
    return data.user;
  },

  async updateStatus(id, status) {
    const { data } = await httpClient.patch(`/users/${id}/status`, { status });
    return data.user;
  },

  async resetPassword(id, password) {
    const { data } = await httpClient.patch(`/users/${id}/reset-password`, password ? { password } : {});
    return data;
  },

  async deleteUser(id) {
    const { data } = await httpClient.delete(`/users/${id}`);
    return data.user;
  },
};
