/**
 * Clockify — Admin Dashboard Controller (admin.js)
 * KPI counters, geofence management, live attendance table & CSV export.
 * Requires api.js (ApiClient) loaded first.
 */

const AdminApp = (() => {
  const REFRESH_INTERVAL_MS = 30000;

  const els = {
    kpiTotalEmployees: document.getElementById("kpiTotalEmployees"),
    kpiClockedInToday: document.getElementById("kpiClockedInToday"),
    kpiLateArrivals: document.getElementById("kpiLateArrivals"),
    kpiOutsideAttempts: document.getElementById("kpiOutsideAttempts"),

    workplaceName: document.getElementById("workplaceName"),
    workplaceLat: document.getElementById("workplaceLat"),
    workplaceLon: document.getElementById("workplaceLon"),
    workplaceRadius: document.getElementById("workplaceRadius"),
    btnUseCurrentLocation: document.getElementById("btnUseCurrentLocation"),
    btnSaveGeofence: document.getElementById("btnSaveGeofence"),

    filterDate: document.getElementById("filterDate"),
    searchEmployee: document.getElementById("searchEmployee"),
    btnExportCsv: document.getElementById("btnExportCsv"),
    btnSeedDemo: document.getElementById("btnSeedDemo"),
    attendanceTableBody: document.getElementById("attendanceTableBody"),

    toastContainer: document.getElementById("toastContainer")
  };

  let allRecords = [];
  let currentGeofence = null;

  const todayStr = () => new Date().toISOString().split("T")[0];

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ================= Initialization =================
  async function init() {
    bindEvents();
    els.filterDate.value = todayStr();
    await Promise.all([loadKpis(), loadGeofence(), loadRecords()]);
    setInterval(refreshLiveData, REFRESH_INTERVAL_MS);
  }

  async function refreshLiveData() {
    await Promise.all([loadKpis({ silent: true }), loadRecords({ silent: true })]);
  }

  // ================= KPI Cards =================
  async function loadKpis({ silent } = {}) {
    try {
      const [employees, metrics] = await Promise.all([
        ApiClient.getEmployees(),
        ApiClient.getAdminMetrics()
      ]);
      els.kpiTotalEmployees.textContent = employees.length;
      els.kpiClockedInToday.textContent = metrics.total_present ?? 0;
      els.kpiLateArrivals.textContent = metrics.late_arrivals ?? 0;
      els.kpiOutsideAttempts.textContent = metrics.outside_boundary_attempts ?? 0;
    } catch (err) {
      if (!silent) showToast("Failed to load dashboard metrics.", "error");
    }
  }

  // ================= Geofence Settings =================
  async function loadGeofence({ silent } = {}) {
    try {
      const geo = await ApiClient.getGeofence();
      currentGeofence = geo;
      els.workplaceName.value = geo.name ?? "";
      els.workplaceLat.value = geo.latitude ?? "";
      els.workplaceLon.value = geo.longitude ?? "";
      els.workplaceRadius.value = geo.radius_meters ?? "";
    } catch (err) {
      if (!silent) showToast("Could not load saved geofence; showing defaults.", "warning");
    }
  }

  function readGeofenceForm() {
    return {
      name: els.workplaceName.value.trim(),
      latitude: parseFloat(els.workplaceLat.value),
      longitude: parseFloat(els.workplaceLon.value),
      radius_meters: parseFloat(els.workplaceRadius.value)
    };
  }

  function validateGeofence(payload) {
    if (!payload.name) return "Workplace name is required.";
    if (isNaN(payload.latitude) || payload.latitude < -90 || payload.latitude > 90)
      return "Latitude must be a number between -90 and 90.";
    if (isNaN(payload.longitude) || payload.longitude < -180 || payload.longitude > 180)
      return "Longitude must be a number between -180 and 180.";
    if (isNaN(payload.radius_meters) || payload.radius_meters <= 0)
      return "Radius must be a positive number of meters.";
    return null;
  }

  async function saveGeofence() {
    const payload = readGeofenceForm();
    const error = validateGeofence(payload);
    if (error) return showToast(error, "error");

    try {
      const response = await ApiClient.updateGeofence({
        ...payload,
        work_start_time: currentGeofence?.work_start_time || "09:00"
      });
      currentGeofence = response.geofence || { ...currentGeofence, ...payload };
      showToast("Geofence updated successfully.", "success");
    } catch (err) {
      showToast(err.message || "Failed to update geofence.", "error");
    }
  }

  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      return showToast("Geolocation is not supported by this browser.", "error");
    }

    showToast("Detecting your current location…", "warning");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        els.workplaceLat.value = position.coords.latitude.toFixed(6);
        els.workplaceLon.value = position.coords.longitude.toFixed(6);
        showToast(
          `Location captured (±${Math.round(position.coords.accuracy)}m). Click Save Geofence to apply.`,
          "success"
        );
      },
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Allow GPS access in your browser settings and try again."
            : err.code === err.TIMEOUT
              ? "GPS request timed out. Please try again."
              : "Unable to retrieve your current location.";
        showToast(message, "error");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  // ================= Live Attendance Table =================
  async function loadRecords({ silent } = {}) {
    try {
      const date = els.filterDate.value || undefined;
      allRecords = await ApiClient.getAdminRecords(date);
      renderTable(applySearch(allRecords));
    } catch (err) {
      if (!silent) showToast("Failed to load attendance records.", "error");
      allRecords = [];
      renderTable([]);
    }
  }

  function applySearch(records) {
    const term = els.searchEmployee.value.trim().toLowerCase();
    if (!term) return records;
    return records.filter(
      (r) =>
        (r.employee_name && r.employee_name.toLowerCase().includes(term)) ||
        (r.department && r.department.toLowerCase().includes(term))
    );
  }

  function renderTable(records) {
    if (!records.length) {
      els.attendanceTableBody.innerHTML =
        '<tr><td colspan="7" class="table-empty">No attendance records found.</td></tr>';
      return;
    }

    els.attendanceTableBody.innerHTML = records
      .map(
        (r) => `
      <tr>
        <td>
          <strong>${escapeHtml(r.employee_name || "Staff #" + r.employee_id)}</strong>
          <div class="cell-sub">${escapeHtml(r.department || "")}</div>
        </td>
        <td>${escapeHtml(r.date || "")}</td>
        <td>
          ${r.clock_in_time ? escapeHtml(r.clock_in_time) : "—"}
          ${r.clock_in_distance != null ? `<div class="cell-sub">${r.clock_in_distance}m away</div>` : ""}
        </td>
        <td>${r.clock_out_time ? escapeHtml(r.clock_out_time) : '<span class="cell-dim">—</span>'}</td>
        <td>
          <span class="status-chip ${r.status === "CLOCKED_IN" ? "chip-in" : "chip-out"}">
            ${r.status === "CLOCKED_IN" ? "On Site" : "Done"}
          </span>
        </td>
        <td>
          <span class="status-chip ${r.is_late ? "tag-late" : "tag-ontime"}">
            ${r.is_late ? "Late" : "On Time"}
          </span>
        </td>
        <td class="cell-notes">${escapeHtml(r.notes || "Verified")}</td>
      </tr>`
      )
      .join("");
  }

  // ================= CSV Export =================
  async function exportCsv() {
    try {
      const date = els.filterDate.value;
      const url = `${window.location.origin}/api/admin/export/csv${date ? `?date=${encodeURIComponent(date)}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("CSV export failed on the server.");

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/);
      const filename = match ? match[1] : `attendance_report_${date || "all"}.csv`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);

      showToast("CSV report downloaded.", "success");
    } catch (err) {
      showToast(err.message || "CSV export failed.", "error");
    }
  }

  // ================= Demo Seed =================
  async function seedDemo() {
    try {
      await ApiClient.seedDemo();
      showToast("Sample attendance records generated.", "success");
      await refreshLiveData();
    } catch (err) {
      showToast(err.message || "Failed to generate sample data.", "error");
    }
  }

  // ================= Events =================
  function bindEvents() {
    els.btnSaveGeofence.addEventListener("click", saveGeofence);
    els.btnUseCurrentLocation.addEventListener("click", useCurrentLocation);
    els.filterDate.addEventListener("change", () => loadRecords());
    els.searchEmployee.addEventListener("input", () => renderTable(applySearch(allRecords)));
    els.btnExportCsv.addEventListener("click", exportCsv);
    if (els.btnSeedDemo) els.btnSeedDemo.addEventListener("click", seedDemo);
  }

  // ================= Toast =================
  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    els.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", AdminApp.init);
