import httpClient from "../services/httpClient";

export const loginUser = async (data) => {
  const res = await httpClient.post("/auth/login", data);
  return res.data;
};

export const createUser = async (data) => {
  const res = await httpClient.post("/users/create", data);

  return res.data;
};

export const getUsers = async () => {
  const res = await httpClient.get("/users");

  return res.data;
};
