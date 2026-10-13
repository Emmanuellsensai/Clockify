/**
 * Clockify — Admin Dashboard Controller (admin.js)
 * Live KPI counters, geofence management console, attendance log viewer & CSV export
 */

// DOM Elements
const adminElements = {
  // KPIs
  kpiTotalStaff: document.getElementById("kpiTotalStaff"),
  kpiPresent: document.getElementById("kpiPresent"),
  kpiClockedInNow: document.getElementById("kpiClockedInNow"),
  kpiLate: document.getElementById("kpiLate"),
  kpiAbsent: document.getElementById("kpiAbsent"),

  // Geofence Form
  workplaceName: document.getElementById("workplaceName"),
  workplaceLat: document.getElementById("workplaceLat"),
  workplaceLon: document.getElementById("workplaceLon"),
  workplaceRadius: document.getElementById("workplaceRadius"),
  workStartTime: document.getElementById("workStartTime"),
  btnSaveGeofence: document.getElementById("btnSaveGeofence"),
  btnUseCurrentGps: document.getElementById("btnUseCurrentGps"),

  // Table & Filters
  filterDate: document.getElementById("filterDate"),
  searchEmployee: document.getElementById("searchEmployee"),
  btnApplyFilters: document.getElementById("btnApplyFilters"),
  btnExportCsv: document.getElementById("btnExportCsv"),
  btnSeedDemo: document.getElementById("btnSeedDemo"),
  attendanceTableBody: document.getElementById("attendanceTableBody"),

  toastContainer: document.getElementById("toastContainer")
};

let allRecords = [];

// Initialize Admin Portal
async function initAdmin() {
  setupAdminListeners();

  // Set default filter date to today
  const today = new Date().toISOString().split("T")[0];
  adminElements.filterDate.value = today;

  try {
    await loadMetrics(today);
    await loadGeofenceSettings();
    await loadAttendanceRecords(today);
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Load KPIs
async function loadMetrics(date) {
  try {
    const data = await ApiClient.getAdminMetrics(date);
    adminElements.kpiTotalStaff.textContent = data.total_employees;
    adminElements.kpiPresent.textContent = data.total_present;
    adminElements.kpiClockedInNow.textContent = data.clocked_in_now;
    adminElements.kpiLate.textContent = data.late_arrivals;
    adminElements.kpiAbsent.textContent = data.absent;
  } catch (err) {
    console.error("Failed to load metrics:", err);
  }
}

// Load Geofence Configuration
async function loadGeofenceSettings() {
  try {
    const geo = await ApiClient.getGeofence();
    adminElements.workplaceName.value = geo.name;
    adminElements.workplaceLat.value = geo.latitude;
    adminElements.workplaceLon.value = geo.longitude;
    adminElements.workplaceRadius.value = geo.radius_meters;
    adminElements.workStartTime.value = geo.work_start_time || "09:00";
  } catch (err) {
    console.error("Failed to load geofence:", err);
  }
}

// Load Attendance Records
async function loadAttendanceRecords(date) {
  try {
    allRecords = await ApiClient.getAdminRecords(date);
    renderAttendanceTable(allRecords);
  } catch (err) {
    console.error("Failed to load records:", err);
  }
}

// Render Table Rows
function renderAttendanceTable(records) {
  if (!records || records.length === 0) {
    adminElements.attendanceTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-dim); padding: 2rem;">
          No attendance records found for this selection.
        </td>
      </tr>
    `;
    return;
  }

  adminElements.attendanceTableBody.innerHTML = records.map(r => `
    <tr>
      <td>
        <strong>${r.employee_name || 'Staff #' + r.employee_id}</strong>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${r.department || ''}</div>
      </td>
      <td>${r.date}</td>
      <td>
        ${r.clock_in_time || 'N/A'}
        <div style="font-size: 0.75rem; color: var(--text-dim);">${r.clock_in_distance != null ? r.clock_in_distance + 'm' : ''}</div>
      </td>
      <td>
        ${r.clock_out_time || '<span style="color:var(--text-dim);">--:--</span>'}
      </td>
      <td>
        <span class="status-chip ${r.status === 'CLOCKED_IN' ? 'chip-in' : 'chip-out'}">
          ${r.status === 'CLOCKED_IN' ? 'Active' : 'Completed'}
        </span>
      </td>
      <td>
        <span class="status-chip ${r.is_late ? 'tag-late' : 'tag-ontime'}">
          ${r.is_late ? 'Late' : 'On Time'}
        </span>
      </td>
      <td style="font-size: 0.8rem; color: var(--text-muted);">
        ${r.notes || 'Verified'}
      </td>
    </tr>
  `).join("");
}

// Event Listeners
function setupAdminListeners() {
  // Save Geofence Form
  adminElements.btnSaveGeofence.addEventListener("click", async () => {
    try {
      const payload = {
        name: adminElements.workplaceName.value,
        latitude: parseFloat(adminElements.workplaceLat.value),
        longitude: parseFloat(adminElements.workplaceLon.value),
        radius_meters: parseFloat(adminElements.workplaceRadius.value),
        work_start_time: adminElements.workStartTime.value
      };

      await ApiClient.updateGeofence(payload);
      showToast("Workplace geofence coordinates updated successfully!", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Use Current GPS as Office
  adminElements.btnUseCurrentGps.addEventListener("click", async () => {
    try {
      showToast("Acquiring current device coordinates...", "warning");
      const pos = await GeoService.getCurrentPosition();
      adminElements.workplaceLat.value = pos.latitude;
      adminElements.workplaceLon.value = pos.longitude;
      showToast(`Filled current location (±${pos.accuracy}m). Click 'Save Coordinates' to apply.`, "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Apply Date Filter
  adminElements.btnApplyFilters.addEventListener("click", async () => {
    const date = adminElements.filterDate.value;
    await loadMetrics(date);
    await loadAttendanceRecords(date);
  });

  // Search Filter by Name
  adminElements.searchEmployee.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allRecords.filter(r => 
      (r.employee_name && r.employee_name.toLowerCase().includes(term)) ||
      (r.department && r.department.toLowerCase().includes(term))
    );
    renderAttendanceTable(filtered);
  });

  // Export CSV
  adminElements.btnExportCsv.addEventListener("click", () => {
    const date = adminElements.filterDate.value;
    const url = `${window.location.origin}/api/admin/export/csv${date ? '?date=' + date : ''}`;
    window.open(url, "_blank");
  });

  // Seed Demo Data
  adminElements.btnSeedDemo.addEventListener("click", async () => {
    try {
      await ApiClient.seedDemo();
      showToast("Demo attendance logs loaded!", "success");
      const date = adminElements.filterDate.value;
      await loadMetrics(date);
      await loadAttendanceRecords(date);
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

// Toast
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  adminElements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

document.addEventListener("DOMContentLoaded", initAdmin);
