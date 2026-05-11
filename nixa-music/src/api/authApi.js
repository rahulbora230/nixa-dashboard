import axios from "axios";

const API = "http://localhost:5000/api/users";

export const loginUser = async (data) => {
  const res = await axios.post(`${API}/login`, data);
  return res.data;
};

export const createUser = async (data) => {
  const token = localStorage.getItem("token");

  const res = await axios.post(`${API}/create`, data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
};

export const getUsers = async () => {
  const token = localStorage.getItem("token");

  const res = await axios.get(API, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
};