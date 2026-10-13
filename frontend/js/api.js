/**
 * Clockify — Centralized API Client (api.js)
 * Clean async fetch handlers and error abstraction
 */

const API_BASE = window.location.origin;

const ApiClient = {
  async get(endpoint) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail?.message || data.detail || "API request failed");
      }
      return data;
    } catch (err) {
      console.error(`GET ${endpoint} failed:`, err);
      throw err;
    }
  },

  async post(endpoint, payload) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail?.message || data.detail || "Request failed");
      }
      return data;
    } catch (err) {
      console.error(`POST ${endpoint} failed:`, err);
      throw err;
    }
  },

  async put(endpoint, payload) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail?.message || data.detail || "Request failed");
      }
      return data;
    } catch (err) {
      console.error(`PUT ${endpoint} failed:`, err);
      throw err;
    }
  },

  // Employee Endpoints
  getEmployees() {
    return this.get("/api/employees");
  },

  getEmployee(id) {
    return this.get(`/api/employees/${id}`);
  },

  // Attendance Endpoints
  getStatus(employeeId) {
    return this.get(`/api/attendance/status/${employeeId}`);
  },

  getHistory(employeeId) {
    return this.get(`/api/attendance/history/${employeeId}`);
  },

  clockIn(employeeId, latitude, longitude, accuracy) {
    return this.post("/api/attendance/clock-in", {
      employee_id: employeeId,
      latitude,
      longitude,
      accuracy
    });
  },

  clockOut(employeeId, latitude, longitude, accuracy) {
    return this.post("/api/attendance/clock-out", {
      employee_id: employeeId,
      latitude,
      longitude,
      accuracy
    });
  },

  // Admin Endpoints
  getGeofence() {
    return this.get("/api/admin/geofence");
  },

  updateGeofence(payload) {
    return this.put("/api/admin/geofence", payload);
  },

  getAdminMetrics(date) {
    const q = date ? `?date=${encodeURIComponent(date)}` : "";
    return this.get(`/api/admin/metrics${q}`);
  },

  getAdminRecords(date, employeeId) {
    const params = new URLSearchParams();
    if (date) params.append("date", date);
    if (employeeId) params.append("employee_id", employeeId);
    const q = params.toString() ? `?${params.toString()}` : "";
    return this.get(`/api/admin/records${q}`);
  },

  seedDemo() {
    return this.post("/api/admin/seed-demo-data", {});
  }
};
