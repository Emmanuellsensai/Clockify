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
  geofenceSaveText: document.getElementById("geofenceSaveText"),

  // Table & Filters
  filterDate: document.getElementById("filterDate"),
  searchEmployee: document.getElementById("searchEmployee"),
  btnApplyFilters: document.getElementById("btnApplyFilters"),
  btnExportCsv: document.getElementById("btnExportCsv"),
  btnSeedDemo: document.getElementById("btnSeedDemo"),
  attendanceTableBody: document.getElementById("attendanceTableBody"),

  toastContainer: document.getElementById("toastContainer")
};

const STORAGE_KEY_GEOFENCE = "clockify_permanent_geofence";
let allRecords = [];

function getLocalDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Initialize Admin Portal
async function initAdmin() {
  setupAdminListeners();

  // Set default filter date to today in local calendar time
  const today = getLocalDateString();
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

// Load Geofence Configuration with Permanent Persistence
async function loadGeofenceSettings() {
  let savedLocal = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GEOFENCE);
    if (raw) savedLocal = JSON.parse(raw);
  } catch (e) {}

  if (savedLocal) {
    adminElements.workplaceName.value = savedLocal.name || "Workplace Headquarters";
    adminElements.workplaceLat.value = savedLocal.latitude;
    adminElements.workplaceLon.value = savedLocal.longitude;
    adminElements.workplaceRadius.value = savedLocal.radius_meters || 150;
    adminElements.workStartTime.value = savedLocal.work_start_time || "09:00";
    if (adminElements.geofenceSaveText) {
      adminElements.geofenceSaveText.textContent = `Permanent perimeter active: ${Number(savedLocal.latitude).toFixed(5)}, ${Number(savedLocal.longitude).toFixed(5)}`;
    }
  }

  try {
    const geo = await ApiClient.getGeofence();
    if (savedLocal) {
      // If backend has default/different coordinates (e.g. serverless cold-start reset), re-sync to saved permanent perimeter
      const diff = Math.abs(geo.latitude - savedLocal.latitude) > 0.00005 ||
                   Math.abs(geo.longitude - savedLocal.longitude) > 0.00005 ||
                   parseFloat(geo.radius_meters) !== parseFloat(savedLocal.radius_meters);
      if (diff) {
        await ApiClient.updateGeofence(savedLocal);
        console.log("Auto-synced permanent geofence to backend database");
      }
    } else {
      localStorage.setItem(STORAGE_KEY_GEOFENCE, JSON.stringify(geo));
      adminElements.workplaceName.value = geo.name;
      adminElements.workplaceLat.value = geo.latitude;
      adminElements.workplaceLon.value = geo.longitude;
      adminElements.workplaceRadius.value = geo.radius_meters;
      adminElements.workStartTime.value = geo.work_start_time || "09:00";
    }
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
  function initials(name) {
    return (name || '?').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  if (!records || records.length === 0) {
    adminElements.attendanceTableBody.innerHTML = `
      <tr><td colspan="7">
        <div class="tbl-empty">
          <div class="tbl-empty-ic">📋</div>
          <div class="tbl-empty-msg">No records found</div>
          <div class="tbl-empty-sub">Try changing the date or search filter.</div>
        </div>
      </td></tr>`;
    return;
  }

  adminElements.attendanceTableBody.innerHTML = records.map(r => {
    const name    = r.employee_name || 'Staff #' + r.employee_id;
    const dept    = r.department || '';
    const active  = r.status === 'CLOCKED_IN';
    const outCell = r.clock_out_time
      ? `<span class="td-time">${r.clock_out_time}</span>`
      : `<span class="td-time td-na">—</span>`;
    const gps = r.clock_in_distance != null
      ? `<div style="font-size:.7rem;color:var(--t3);margin-top:2px;font-family:var(--mono);">GPS ${r.clock_in_distance}m</div>` : '';

    return `<tr>
      <td>
        <div class="td-emp">
          <div class="td-av">${initials(name)}</div>
          <div>
            <div class="td-name">${name}</div>
            ${dept ? `<div class="td-dept">${dept}</div>` : ''}
          </div>
        </div>
      </td>
      <td style="white-space:nowrap;color:var(--t2);font-size:.84rem;">${r.date}</td>
      <td><span class="td-time">${r.clock_in_time || '<span class="td-na">—</span>'}</span>${gps}</td>
      <td>${outCell}</td>
      <td><span class="chip ${active ? 'chip-in' : 'chip-done'}">${active ? '● Active' : '◎ Done'}</span></td>
      <td><span class="chip ${r.is_late ? 'chip-late' : 'chip-ontime'}">${r.is_late ? '⏰ Late' : '✓ On Time'}</span></td>
      <td style="font-size:.78rem;color:var(--t3);">${r.notes || 'Verified'}</td>
    </tr>`;
  }).join('');
}

// Event Listeners
function setupAdminListeners() {
  // Save Geofence Form
  adminElements.btnSaveGeofence.addEventListener("click", async () => {
    try {
      const lat = parseFloat(adminElements.workplaceLat.value);
      const lon = parseFloat(adminElements.workplaceLon.value);
      const radius = parseFloat(adminElements.workplaceRadius.value);
      const name = adminElements.workplaceName.value.trim() || "Workplace Headquarters";
      const startTime = adminElements.workStartTime.value || "09:00";

      if (isNaN(lat) || isNaN(lon) || isNaN(radius)) {
        showToast("Please enter valid latitude, longitude, and radius values.", "error");
        return;
      }

      const payload = {
        name: name,
        latitude: lat,
        longitude: lon,
        radius_meters: radius,
        work_start_time: startTime
      };

      await ApiClient.updateGeofence(payload);
      localStorage.setItem(STORAGE_KEY_GEOFENCE, JSON.stringify(payload));
      if (adminElements.geofenceSaveText) {
        adminElements.geofenceSaveText.textContent = `Permanent perimeter active: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      }
      showToast("Perimeter saved permanently! Preserved across page reloads.", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Use Current GPS as Office Perimeter (Immediately auto-saves permanently)
  adminElements.btnUseCurrentGps.addEventListener("click", async () => {
    try {
      showToast("Acquiring device GPS coordinates...", "warning");
      const pos = await GeoService.getCurrentPosition();
      adminElements.workplaceLat.value = pos.latitude;
      adminElements.workplaceLon.value = pos.longitude;

      const payload = {
        name: adminElements.workplaceName.value.trim() || "Admin Designated Perimeter",
        latitude: pos.latitude,
        longitude: pos.longitude,
        radius_meters: parseFloat(adminElements.workplaceRadius.value) || 150,
        work_start_time: adminElements.workStartTime.value || "09:00"
      };

      // Immediately auto-save to backend and localStorage so it is permanent
      await ApiClient.updateGeofence(payload);
      localStorage.setItem(STORAGE_KEY_GEOFENCE, JSON.stringify(payload));
      if (adminElements.geofenceSaveText) {
        adminElements.geofenceSaveText.textContent = `Permanent perimeter active: ${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}`;
      }
      showToast(`📍 Set & permanently saved perimeter to your location (±${pos.accuracy}m)!`, "success");
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
const ADMIN_ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<div class="t-icon">${ADMIN_ICONS[type] || 'ℹ'}</div><span>${message}</span>`;
  adminElements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(110%)';
    toast.style.transition = 'all .35s cubic-bezier(.4,0,1,1)';
    setTimeout(() => toast.remove(), 360);
  }, 4500);
}

document.addEventListener("DOMContentLoaded", initAdmin);
