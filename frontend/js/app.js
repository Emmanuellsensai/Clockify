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
  digitalClock:        document.getElementById('digitalClock'),
  dateDisplay:         document.getElementById('dateDisplay'),
  employeeName:        document.getElementById('employeeName'),
  employeeDept:        document.getElementById('employeeDept'),
  employeeAvatar:      document.getElementById('employeeAvatar'),
  btnSwitchEmployee:   document.getElementById('btnSwitchEmployee'),
  modalSwitch:         document.getElementById('modalSwitch'),
  modalClose:          document.getElementById('modalClose'),
  modalSearchInput:    document.getElementById('modalSearchInput'),
  employeeSelectList:  document.getElementById('employeeSelectList'),

  // Radar / Status — new v3 IDs
  statusBadge:   document.getElementById('statusBadge'),
  distanceValue: document.getElementById('distanceValue'),
  distanceSub:   document.getElementById('distanceSub'),
  radarWrapEl:   document.getElementById('radarWrapEl'),
  radarDot:      document.getElementById('radarDot'),

  // Action Button
  btnAction:      document.getElementById('btnAction'),
  actionBtnText:  document.getElementById('actionBtnText'),

  // Today Summary
  todayClockIn:  document.getElementById('todayClockIn'),
  todayClockOut: document.getElementById('todayClockOut'),

  // History
  historyList:   document.getElementById('historyList'),
  historyCount:  document.getElementById('historyCount'),
  toastContainer: document.getElementById('toastContainer')
};

// Initialize Application
async function init() {
  startClock();
  setupEventListeners();

  try {
    // 1. Fetch Geofence Settings
    AppState.workplace = await ApiClient.getGeofence();
    
    // Check if admin has saved a permanent geofence in localStorage
    const savedGeoStr = localStorage.getItem("clockify_permanent_geofence");
    if (savedGeoStr) {
      try {
        const savedGeo = JSON.parse(savedGeoStr);
        const diff = Math.abs(AppState.workplace.latitude - savedGeo.latitude) > 0.00005 ||
                     Math.abs(AppState.workplace.longitude - savedGeo.longitude) > 0.00005 ||
                     parseFloat(AppState.workplace.radius_meters) !== parseFloat(savedGeo.radius_meters);
        if (diff) {
          // Keep backend synchronized with permanent perimeter
          await ApiClient.updateGeofence(savedGeo);
          AppState.workplace = savedGeo;
        }
      } catch (e) {}
    }
    
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
    elements.historyCount.textContent = records && records.length > 0
      ? `${records.length} record${records.length !== 1 ? 's' : ''}`
      : '0 records';
  }

  if (!records || records.length === 0) {
    elements.historyList.innerHTML = `
      <div class="empty">
        <div class="empty-ic">📅</div>
        <div class="empty-msg">No recent attendance records</div>
      </div>`;
    return;
  }

  elements.historyList.innerHTML = records.map(r => {
    const dateObj = r.date ? new Date(r.date + 'T00:00:00') : null;
    const dayNum  = dateObj ? dateObj.getDate() : '--';
    const dayMon  = dateObj ? dateObj.toLocaleDateString([], { month: 'short' }).toUpperCase() : '---';
    return `
    <div class="h-item" role="listitem">
      <div class="h-left">
        <div class="h-date-box" aria-hidden="true">
          <span class="h-day">${dayNum}</span>
          <span class="h-mon">${dayMon}</span>
        </div>
        <div class="h-info">
          <div class="h-date-str">${r.date}</div>
          <div class="h-times">In: ${r.clock_in_time || 'N/A'}&nbsp;·&nbsp;Out: ${r.clock_out_time || 'In Progress'}</div>
        </div>
      </div>
      <span class="h-badge ${r.is_late ? 'h-late' : 'h-ontime'}">
        ${r.is_late ? '⏰ Late' : '✓ On Time'}
      </span>
    </div>`;
  }).join('');
}

// Query Live Location & Update Radar
async function queryLiveLocation() {
  elements.statusBadge.className = 'status-pill pill-checking';
  elements.statusBadge.innerHTML = '<span class="pill-dot"></span> Locating GPS…';

  try {
    const pos = await GeoService.getCurrentPosition();
    AppState.currentLocation = pos;
    updateDistanceRadar(pos.latitude, pos.longitude, pos.accuracy);
  } catch (err) {
    elements.statusBadge.className = 'status-pill pill-outside';
    elements.statusBadge.innerHTML = '<span class="pill-dot"></span> GPS Offline';
    elements.distanceValue.textContent = 'GPS Error';
    elements.distanceSub.textContent   = err.message;
  }
}

// Distance Radar Update
function updateDistanceRadar(lat, lon, accuracy) {
  if (!AppState.workplace) return;

  const dist     = GeoService.calculateDistance(lat, lon, AppState.workplace.latitude, AppState.workplace.longitude);
  const radius   = AppState.workplace.radius_meters;
  const isInside = dist <= radius;

  elements.distanceValue.textContent = `${dist}m away`;
  elements.distanceSub.textContent   = `${AppState.workplace.name} · Radius ${radius}m · GPS ±${accuracy}m`;

  if (isInside) {
    elements.statusBadge.className = 'status-pill pill-inside';
    elements.statusBadge.innerHTML = '<span class="pill-dot"></span> Inside Workplace';
    if (elements.radarWrapEl) elements.radarWrapEl.className = 'radar-wrap is-inside';
    if (elements.radarDot)    elements.radarDot.className    = 'radar-user dot-inside';
  } else {
    elements.statusBadge.className = 'status-pill pill-outside';
    elements.statusBadge.innerHTML = '<span class="pill-dot"></span> Outside Perimeter';
    if (elements.radarWrapEl) elements.radarWrapEl.className = 'radar-wrap is-outside';
    if (elements.radarDot)    elements.radarDot.className    = 'radar-user dot-outside';
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
    elements.employeeSelectList.innerHTML =
      `<div style="text-align:center;color:var(--t3);padding:1.5rem 1rem;font-size:.84rem;">No employees match.</div>`;
    return;
  }

  elements.employeeSelectList.innerHTML = filtered.map(emp => {
    const isActive = AppState.currentEmployee && AppState.currentEmployee.id === emp.id;
    return `
    <div class="emp-opt${isActive ? ' active' : ''}" data-id="${emp.id}" role="option" aria-selected="${isActive}" tabindex="0">
      <div class="emp-av">${getInitials(emp.name)}</div>
      <div>
        <div class="emp-name">${emp.name}</div>
        <div class="emp-meta">${emp.department} &bull; ${emp.staff_id}</div>
      </div>
      <span class="emp-arrow">${isActive ? '✓' : '→'}</span>
    </div>`;
  }).join('');

  elements.employeeSelectList.querySelectorAll('.emp-opt').forEach(card => {
    const activate = async () => {
      const id = parseInt(card.getAttribute('data-id'));
      AppState.currentEmployee = AppState.employeesList.find(e => e.id === id);
      localStorage.setItem('clockify_active_emp_id', id);
      renderEmployeeProfile();
      elements.modalSwitch.classList.remove('open');
      await refreshShiftData();
      showToast(`Switched to ${AppState.currentEmployee.name}`, 'warning');
    };
    card.addEventListener('click', activate);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') activate(); });
  });
}

// Toast Notifications
const TOAST_ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="t-icon">${TOAST_ICONS[type] || 'ℹ'}</div>
    <span>${message}</span>
  `;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(110%)';
    toast.style.transition = 'all .35s cubic-bezier(.4,0,1,1)';
    setTimeout(() => toast.remove(), 360);
  }, 4500);
}

// Run on page load
document.addEventListener("DOMContentLoaded", init);
