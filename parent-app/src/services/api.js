import axios from 'axios';

// Note: Change to your computer's local IP address (e.g. 'http://192.168.1.10:5000/api') 
const API_BASE = 'http://10.20.41.146:5000/api';
export const IMAGE_HOST = 'http://10.20.41.146:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

export const api = {
  login: async (userId, password) => {
    try {
      const res = await apiClient.post('/parent/login', { user_id: userId, password });
      return res.data;
    } catch (err) {
      if (err.message === 'Network Error' || !err.response) {
        throw new Error(`Network Error: Cannot connect to backend at ${API_BASE}. Please change 'localhost' in parent-app/src/services/api.js to your local IP.`);
      }
      throw new Error(err.response?.data?.error || 'Login failed');
    }
  },
  getAttendance: async (token) => {
    try {
      const res = await apiClient.get('/parent/attendance', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to fetch attendance');
    }
  },
  getResults: async (token) => {
    try {
      const res = await apiClient.get('/parent/results', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to fetch results');
    }
  },
  getNotifications: async (token) => {
    try {
      const res = await apiClient.get('/parent/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to fetch notifications');
    }
  },
  markNotificationRead: async (token, notificationId) => {
    try {
      const res = await apiClient.put(`/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to mark read');
    }
  }
};
