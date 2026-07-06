import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [student, setStudent] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data states
  const [attendance, setAttendance] = useState([]);
  const [results, setResults] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Load token on startup
  useEffect(() => {
    async function loadStorage() {
      try {
        const storedToken = await AsyncStorage.getItem('parentToken');
        const storedStudent = await AsyncStorage.getItem('parentStudent');
        if (storedToken && storedStudent) {
          setToken(storedToken);
          setStudent(JSON.parse(storedStudent));
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error('Failed to load storage data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStorage();
  }, []);

  const login = async (userId, password) => {
    try {
      const data = await api.login(userId, password);
      await AsyncStorage.setItem('parentToken', data.token);
      await AsyncStorage.setItem('parentStudent', JSON.stringify(data.student_data));
      setToken(data.token);
      setStudent(data.student_data);
      setIsAuthenticated(true);
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('parentToken');
      await AsyncStorage.removeItem('parentStudent');
      setToken(null);
      setStudent(null);
      setIsAuthenticated(false);
      setAttendance([]);
      setResults([]);
      setNotifications([]);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = useCallback(async () => {
    if (!token) return;
    setDataLoading(true);
    try {
      const [attData, resultsData, notificationsData] = await Promise.all([
        api.getAttendance(token),
        api.getResults(token),
        api.getNotifications(token)
      ]);
      setAttendance(attData);
      setResults(resultsData);
      setNotifications(notificationsData);
    } catch (err) {
      console.error('Failed to fetch parent dashboard data:', err);
      if (err.message?.includes('Not authorized') || err.message?.includes('401')) {
        logout();
      }
    } finally {
      setDataLoading(false);
    }
  }, [token]);

  const markNotificationRead = useCallback(async (notificationId) => {
    if (!token) return;
    try {
      await api.markNotificationRead(token, notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, fetchData]);

  const value = {
    token,
    student,
    isAuthenticated,
    loading,
    attendance,
    results,
    notifications,
    dataLoading,
    login,
    logout,
    fetchData,
    markNotificationRead
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
