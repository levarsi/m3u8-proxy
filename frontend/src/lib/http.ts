import axios from 'axios';

export const http = axios.create({
  timeout: 15000
});

// 请求拦截器：添加 Token
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：处理 401
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 清除 Token 并跳转登录页
      localStorage.removeItem('auth_token');
      // 避免无限重定向
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);