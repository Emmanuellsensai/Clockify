/**
 * Clockify — Employee Portal Controller (app.js)
 * Live clock, geolocation synchronization, clock-in/out logic, and UI updates
 */

// Application State
const AppState = {
  currentEmployee: null,
  workplace: null,
  currentLocation: null,
  shiftStatus: "NOT_CLOCKED_IN",
  todayRecord: null,
  employeesList: []
};

// DOM Elements
const elements = {
  digitalClock: document.getElementById("digitalClock"),
  dateDisplay: document.getElementById("dateDisplay"),
  employeeName: document.getElementById("employeeName"),
  employeeDept: document.getElementById("employeeDept"),
  employeeAvatar: document.getElementById("employeeAvatar"),
  btnSwitchEmployee: document.getElementById("btnSwitchEmployee"),
  modalSwitch: document.getElementById("modalSwitch"),
  modalClose: document.getElementById("modalClose"),
  modalSearchInput: document.getElementById("modalSearchInput"),
  employeeSelectList: document.getElementById("employeeSelectList"),

  // Radar / Status
  statusPulse: document.getElementById("statusPulse"),
  statusBadge: document.getElementById("statusBadge"),
  distanceValue: document.getElementById("distanceValue"),
  distanceSub: document.getElementById("distanceSub"),
  radarRingsEl: document.getElementById("radarRingsEl"),
  radarDot: document.getElementById("radarDot"),

  // Action Button
  btnAction: document.getElementById("btnAction"),
  actionBtnText: document.getElementById("actionBtnText"),

  // Today Summary
  todayClockIn: document.getElementById("todayClockIn"),
  todayClockOut: document.getElementById("todayClockOut"),

  // History
  historyList: document.getElementById("historyList"),
  historyCount: document.getElementById("historyCount"),
  toastContainer: document.getElementById("toastContainer")
};

// Initialize Application
async function init() {
  startClock();
  setupEventListeners();

  try {
    // 1. Fetch Geofence Settings
    AppState.workplace = await ApiClient.getGeofence();
    
    // 2. Fetch Employees List
    AppState.employeesList = await ApiClient.getEmployees();
    
    // 3. Select Initial Employee (Stored or First)
    const storedId = localStorage.getItem("clockify_active_emp_id");
    if (storedId) {
      AppState.currentEmployee = AppState.employeesList.find(e => e.id === parseInt(storedId)) || AppState.employeesList[0];
    } else {
      AppState.currentEmployee = AppState.employeesList[0];
    }

    renderEmployeeProfile();
    renderEmployeeModalList();
    
    // 4. Fetch Shift Status & History
    await refreshShiftData();

    // 5. Query Initial Location & Watch Proximity
    queryLiveLocation();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Live Digital Clock
function startClock() {
  function update() {
    const now = new Date();
    elements.digitalClock.textContent = now.toLocaleTimeString([], { hour12: true });
    elements.dateDisplay.textContent = now.toLocaleDateString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }
  update();
  setInterval(update, 1000);
}

// Render Profile
function renderEmployeeProfile() {
  if (!AppState.currentEmployee) return;
  elements.employeeName.textContent = AppState.currentEmployee.name;
  elements.employeeDept.textContent = `${AppState.currentEmployee.department} • ${AppState.currentEmployee.staff_id}`;
  
  const initials = AppState.currentEmployee.name
    .split(" ")
    .map(n => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
  elements.employeeAvatar.textContent = initials;
}

// Refresh Shift Status & History
async function refreshShiftData() {
  if (!AppState.currentEmployee) return;

  try {
    const statusData = await ApiClient.getStatus(AppState.currentEmployee.id);
    AppState.shiftStatus = statusData.status;
    AppState.todayRecord = statusData.record;

    updateActionControls();
    updateTodaySummary();

    const historyData = await ApiClient.getHistory(AppState.currentEmployee.id);
    renderHistory(historyData);
  } catch (err) {
    console.error("Failed to refresh shift:", err);
  }
}

// Update Action Button State
function updateActionControls() {
  elements.btnAction.disabled = false;
  elements.btnAction.classList.remove("btn-clock-out");

  if (AppState.shiftStatus === "NOT_CLOCKED_IN") {
    elements.actionBtnText.textContent = "Clock In Now";
    elements.btnAction.onclick = handleClockIn;
  } else if (AppState.shiftStatus === "CLOCKED_IN") {
    elements.actionBtnText.textContent = "Clock Out";
    elements.btnAction.classList.add("btn-clock-out");
    elements.btnAction.onclick = handleClockOut;
  } else if (AppState.shiftStatus === "CLOCKED_OUT") {
    elements.actionBtnText.textContent = "Shift Completed Today";
    elements.btnAction.disabled = true;
  }
}

// Update Today Summary Cards
function updateTodaySummary() {
  if (AppState.todayRecord) {
    elements.todayClockIn.textContent = AppState.todayRecord.clock_in_time || "--:--";
    elements.todayClockOut.textContent = AppState.todayRecord.clock_out_time || "--:--";
  } else {
    elements.todayClockIn.textContent = "--:--";
    elements.todayClockOut.textContent = "--:--";
  }
}

// Render Attendance History
function renderHistory(records) {
  if (elements.historyCount) {
    elements.historyCount.textContent = records && records.length > 0 ? `${records.length} record${records.length !== 1 ? 's' : ''}` : '0 records';
  }

  if (!records || records.length === 0) {
    elements.historyList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <div class="empty-state-text">No recent attendance records found.</div>
      </div>`;
    return;
  }

  elements.historyList.innerHTML = records.map(r => {
    const dateObj = r.date ? new Date(r.date) : null;
    const dayNum = dateObj ? dateObj.getDate() : '--';
    const dayMon = dateObj ? dateObj.toLocaleDateString([], { month: 'short' }).toUpperCase() : '---';
    return `
    <div class="history-item" role="listitem">
      <div class="history-item-left">
        <div class="history-day-icon" aria-hidden="true">
          <span class="history-day-num">${dayNum}</span>
          <span class="history-day-mon">${dayMon}</span>
        </div>
        <div class="history-content">
          <div class="history-date">${r.date}</div>
          <div class="history-times">In: ${r.clock_in_time || 'N/A'} &nbsp;·&nbsp; Out: ${r.clock_out_time || 'In Progress'}</div>
        </div>
      </div>
      <span class="history-badge ${r.is_late ? 'tag-late' : 'tag-ontime'}">
        ${r.is_late ? '⏰ Late' : '✓ On Time'}
      </span>
    </div>`;
  }).join("");
}

// Query Live Location & Update Radar
async function queryLiveLocation() {
  elements.statusBadge.className = "status-badge badge-checking";
  elements.statusBadge.textContent = "Locating...";
  elements.statusPulse.className = "pulse-indicator";

  try {
    const pos = await GeoService.getCurrentPosition();
    AppState.currentLocation = pos;
    updateDistanceRadar(pos.latitude, pos.longitude, pos.accuracy);
  } catch (err) {
    elements.statusBadge.className = "status-badge badge-outside";
    elements.statusBadge.textContent = "GPS Offline";
    elements.distanceValue.textContent = "GPS Error";
    elements.distanceSub.textContent = err.message;
  }
}

// Distance Radar Update
function updateDistanceRadar(lat, lon, accuracy) {
  if (!AppState.workplace) return;

  const dist = GeoService.calculateDistance(
    lat, lon,
    AppState.workplace.latitude,
    AppState.workplace.longitude
  );

  const radius = AppState.workplace.radius_meters;
  const isInside = dist <= radius;

  elements.distanceValue.textContent = `${dist}m away`;
  elements.distanceSub.textContent = `${AppState.workplace.name} · Within ${radius}m required · GPS ±${accuracy}m`;

  if (isInside) {
    elements.statusBadge.className = "status-badge badge-inside";
    elements.statusBadge.innerHTML = '<span class="pulse-indicator inside" id="statusPulse"></span> Inside Workplace';
    if (elements.radarRingsEl) elements.radarRingsEl.className = "radar-rings status-inside";
    if (elements.radarDot) elements.radarDot.className = "radar-center-dot status-inside";
  } else {
    elements.statusBadge.className = "status-badge badge-outside";
    elements.statusBadge.innerHTML = '<span class="pulse-indicator outside" id="statusPulse"></span> Outside Perimeter';
    if (elements.radarRingsEl) elements.radarRingsEl.className = "radar-rings status-outside";
    if (elements.radarDot) elements.radarDot.className = "radar-center-dot status-outside";
  }
}

// Handle Clock In
async function handleClockIn() {
  elements.btnAction.disabled = true;
  elements.actionBtnText.textContent = "Verifying GPS Location...";

  try {
    const loc = await GeoService.getCurrentPosition();
    AppState.currentLocation = loc;
    updateDistanceRadar(loc.latitude, loc.longitude, loc.accuracy);

    elements.actionBtnText.textContent = "Clocking In...";
    const res = await ApiClient.clockIn(
      AppState.currentEmployee.id,
      loc.latitude,
      loc.longitude,
      loc.accuracy
    );

    showToast(`Arrival verified! Clocked in at ${res.record.clock_in_time}`, "success");
    await refreshShiftData();
  } catch (err) {
    showToast(err.message, "error");
    updateActionControls();
  }
}

// Handle Clock Out
async function handleClockOut() {
  elements.btnAction.disabled = true;
  elements.actionBtnText.textContent = "Verifying Location...";

  try {
    const loc = await GeoService.getCurrentPosition();
    AppState.currentLocation = loc;

    elements.actionBtnText.textContent = "Clocking Out...";
    const res = await ApiClient.clockOut(
      AppState.currentEmployee.id,
      loc.latitude,
      loc.longitude,
      loc.accuracy
    );

    showToast(`Departure recorded at ${res.record.clock_out_time}. Shift completed!`, "success");
    await refreshShiftData();
  } catch (err) {
    showToast(err.message, "error");
    updateActionControls();
  }
}

// Event Listeners & Modals
function setupEventListeners() {
  elements.btnSwitchEmployee.addEventListener('click', () => {
    elements.modalSwitch.classList.add('open');
    renderEmployeeModalList();
    if (elements.modalSearchInput) elements.modalSearchInput.value = '';
    setTimeout(() => elements.modalSearchInput && elements.modalSearchInput.focus(), 100);
  });

  elements.modalClose.addEventListener('click', () => {
    elements.modalSwitch.classList.remove('open');
  });

  elements.modalSwitch.addEventListener('click', (e) => {
    if (e.target === elements.modalSwitch) {
      elements.modalSwitch.classList.remove('open');
    }
  });

  // Keyboard close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') elements.modalSwitch.classList.remove('open');
  });

  // Modal search filter
  if (elements.modalSearchInput) {
    elements.modalSearchInput.addEventListener('input', (e) => {
      renderEmployeeModalList(e.target.value);
    });
  }
}

function getInitials(name) {
  return (name || '?').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function renderEmployeeModalList(filter = '') {
  const filtered = filter
    ? AppState.employeesList.filter(e =>
        e.name.toLowerCase().includes(filter.toLowerCase()) ||
        e.department.toLowerCase().includes(filter.toLowerCase())
      )
    : AppState.employeesList;

  if (filtered.length === 0) {
    elements.employeeSelectList.innerHTML = `<div style="text-align:center; color:var(--text-tertiary); padding:1.5rem 1rem; font-size:0.85rem;">No employees match your search.</div>`;
    return;
  }

  elements.employeeSelectList.innerHTML = filtered.map(emp => {
    const isActive = AppState.currentEmployee && AppState.currentEmployee.id === emp.id;
    return `
    <div class="employee-option-card ${isActive ? 'active' : ''}" data-id="${emp.id}" role="option" aria-selected="${isActive}">
      <div class="emp-opt-avatar">${getInitials(emp.name)}</div>
      <div class="emp-opt-info">
        <div class="emp-opt-name">${emp.name}</div>
        <div class="emp-opt-meta">${emp.department} &bull; ${emp.staff_id}</div>
      </div>
      <span class="emp-opt-select">${isActive ? '✓' : '→'}</span>
    </div>`;
  }).join('');

  elements.employeeSelectList.querySelectorAll('.employee-option-card').forEach(card => {
    card.addEventListener('click', async () => {
      const id = parseInt(card.getAttribute('data-id'));
      AppState.currentEmployee = AppState.employeesList.find(e => e.id === id);
      localStorage.setItem('clockify_active_emp_id', id);
      renderEmployeeProfile();
      elements.modalSwitch.classList.remove('open');
      await refreshShiftData();
      showToast(`Switched to ${AppState.currentEmployee.name}`, 'warning');
    });
  });
}

// Toast Notifications
const TOAST_ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || 'ℹ'}</span>
    <span>${message}</span>
  `;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(110%)';
    toast.style.transition = 'all 0.35s cubic-bezier(0.4, 0, 1, 1)';
    setTimeout(() => toast.remove(), 350);
  }, 4500);
}

// Run on page load
document.addEventListener("DOMContentLoaded", init);
