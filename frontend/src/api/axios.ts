import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    (typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1") &&
    window.location.port === "3000"
      ? "http://localhost:8000/api"
      : "/api"),
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(config => {
  const saved = localStorage.getItem("fs_auth");
  if (saved) {
    const { token } = JSON.parse(saved);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem("fs_auth");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
