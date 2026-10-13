# Clockify — Team Task Allocation & Sprint Timeline

**Sprint Window:** Tuesday, 13th October 2026 – Thursday, 15th October 2026 (12:00 PM)  
**Total Team:** 9 Members  
**Lead Tech:** Architecture, Orchestration & QA Lead

---

## 👥 Team Roster & Role Summary

| # | Name | Sprint Role | Primary Ownership Module |
|---|---|---|---|
| 1 | **Tech Lead (You)** | Architecture & Integration Lead | System architecture, Git reviews, integration & deployment |
| 2 | **Arogundade Habeebat** | Frontend UI/UX Developer | Employee portal interface, responsive layout, CSS design system |
| 3 | **Jonathan Jeremiah** | Frontend Geolocation Specialist | HTML5 GPS client, accuracy checker, radar/distance meter |
| 4 | **Usang Emmanuel** | Backend Database Engineer | SQLite models, migrations, DB connection & seed dataset |
| 5 | **Babatunde Daniel** | Backend Geofencing Engineer | Haversine algorithm, radius evaluation, clock in/out validation |
| 6 | **Ojomo Abiola** | Frontend State & API Integrator | API client, fetch handlers, toast alerts, clock state flow |
| 7 | **Talabi Josiah** | Backend Auth & Employee Engineer | Employee profiles, PIN authentication, session verification |
| 8 | **Oluwasegun Adejumo** | Backend Admin & Analytics Engineer | Reporting service, geofence config API, attendance export |
| 9 | **Olajide Peter** | Admin Frontend Developer | Admin dashboard, live table, geofence manager, CSV export |

---

## 📋 Individual Task Breakdown & Acceptance Criteria

---

### 1. Tech Lead (You)
- **Role:** Lead Architect & Orchestrator
- **Assigned Files:** `run.py`, `backend/main.py`, `ROADMAP.md`, `TEAM_TASKS.md`, `README.md`
- **Key Responsibilities:**
  1. Scaffold project directory structure, establish coding standards, and maintain unified runner (`run.py`).
  2. Define and enforce API schemas and contracts across frontend and backend team members.
  3. Conduct pull request reviews, manage Git merge conflicts, and lead daily 17:30 check-ins.
  4. Perform end-to-end integration testing and run final presentation rehearsal on Thursday morning.
- **Deliverables & Timeline:**
  - *Tuesday 12:00 PM:* Project scaffold, database seed runner, roadmap, and task matrix distributed.
  - *Wednesday 18:00 PM:* Full API integration verified and merged.
  - *Thursday 11:30 AM:* Final code freeze, smoke test, and demo sign-off.
- **Acceptance Criteria:**
  - System launches cleanly with `python run.py`.
  - Frontend loads on both mobile browsers and desktop without errors.

---

### 2. Arogundade Habeebat
- **Role:** Frontend UI/UX Developer
- **Assigned Files:** `frontend/index.html`, `frontend/css/style.css`
- **Key Responsibilities:**
  1. Build a clean, mobile-first responsive web portal for employees to clock in and out.
  2. Implement an elegant, modern visual identity: clean dark palette, glassmorphism cards, glowing status rings, and readable typography.
  3. Render active digital clock showing current local time (hours, minutes, seconds, AM/PM) and current date.
  4. Create UI states for: "Ready to Clock In", "Inside Workplace", "Outside Workplace", "Clocked In", and "Shift Complete".
  5. Build employee profile selector modal and attendance history list view.
- **Deliverables & Timeline:**
  - *Tuesday 18:00:* Complete responsive layout for `index.html` and core design system in `style.css`.
  - *Wednesday 15:00:* Dynamic state styling (active badge, disabled button states, pulse animations).
  - *Thursday 09:30:* Final mobile responsiveness polish and cross-device testing.
- **Acceptance Criteria:**
  - Layout is fully responsive on mobile screen sizes (360px - 430px) as well as desktop.
  - Status indicators visually communicate geolocation state and clock status clearly.

---

### 3. Jonathan Jeremiah
- **Role:** Frontend Geolocation Specialist
- **Assigned Files:** `frontend/js/geo.js`
- **Key Responsibilities:**
  1. Implement HTML5 Geolocation API wrapper using `navigator.geolocation.getCurrentPosition` and `watchPosition`.
  2. Configure high accuracy mode (`enableHighAccuracy: true`, `timeout: 10000`, `maximumAge: 0`).
  3. Implement GPS accuracy verification: warn the user if device accuracy is poor (> 50 meters).
  4. Implement client-side distance helper and real-time distance updater to office coordinates.
  5. Gracefully handle GPS permission denial, timeout, and device unavailable errors with clear user feedback.
- **Deliverables & Timeline:**
  - *Tuesday 18:00:* Working `geo.js` capable of extracting live latitude, longitude, and accuracy radius.
  - *Wednesday 15:00:* Live distance calculator and geofence proximity status callback.
  - *Thursday 09:30:* Edge-case handling for iOS Safari and Android Chrome permission flows.
- **Acceptance Criteria:**
  - Function `getUserLocation()` resolves with `{ latitude, longitude, accuracy }`.
  - Returns human-readable error messages if location permissions are denied.

---

### 4. Usang Emmanuel
- **Role:** Backend Database Engineer
- **Assigned Files:** `backend/database.py`, `backend/models.py`, `backend/config.py`
- **Key Responsibilities:**
  1. Configure SQLite database engine with thread-safe connections.
  2. Design database tables:
     - `employees`: `id`, `staff_id`, `name`, `email`, `department`, `pin`, `created_at`
     - `attendance_records`: `id`, `employee_id`, `date`, `clock_in_time`, `clock_in_lat`, `clock_in_lon`, `clock_in_distance`, `clock_out_time`, `clock_out_lat`, `clock_out_lon`, `status`
     - `workplace_geofences`: `id`, `name`, `latitude`, `longitude`, `radius_meters`, `is_active`
  3. Write database initialization functions and seed data generator with realistic staff members.
- **Deliverables & Timeline:**
  - *Tuesday 18:00:* Complete database tables and seeding script verified.
  - *Wednesday 14:00:* Helper queries for fetching active shift records and daily date queries.
  - *Thursday 09:30:* DB sanity check, clean reset function for presentation demo.
- **Acceptance Criteria:**
  - Database auto-creates tables on initial run without external migration tools.
  - Default workplace coordinates and test employees populate on boot.

---

### 5. Babatunde Daniel
- **Role:** Backend Geofencing & Attendance Engine
- **Assigned Files:** `backend/services/geofence.py`, `backend/routers/attendance.py`
- **Key Responsibilities:**
  1. Implement the Haversine formula in Python to calculate the geodesic distance between employee coordinates and office coordinates in meters:
     $$d = 2r \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$
  2. Implement geofence validation function: checks if distance $\le$ configured radius (e.g., 150m).
  3. Build FastAPI attendance routes:
     - `POST /api/attendance/clock-in`: validates employee, coordinates, verifies geofence, records timestamp.
     - `POST /api/attendance/clock-out`: validates employee, verifies active clock-in, updates departure timestamp.
     - `GET /api/attendance/status/{employee_id}`: returns current daily shift state.
  4. Prevent duplicate clock-ins within the same day without clocking out first.
- **Deliverables & Timeline:**
  - *Tuesday 18:00:* Unit-tested Haversine calculation service in `geofence.py`.
  - *Wednesday 15:00:* Fully functional clock-in and clock-out endpoints with geofence validation.
  - *Thursday 09:30:* Stress testing with mock coordinates (both inside and outside perimeter).
- **Acceptance Criteria:**
  - Clock-in succeeds if employee is within the geofence perimeter ($d \le \text{radius}$).
  - Clock-in is rejected with HTTP 403 / descriptive JSON if distance exceeds radius.

---

### 6. Ojomo Abiola
- **Role:** Frontend State & API Integrator
- **Assigned Files:** `frontend/js/api.js`, `frontend/js/app.js`
- **Key Responsibilities:**
  1. Write centralized HTTP fetch wrapper `api.js` for all backend endpoints with unified error handling.
  2. Connect Clock-In and Clock-Out buttons to `geo.js` and `api.js`:
     - On button click: trigger GPS acquisition $\rightarrow$ send payload with coordinates $\rightarrow$ update UI state.
  3. Implement toast notification banner component for success, warning, and error messages.
  4. Maintain local employee session storage (`localStorage` fallback for active employee ID).
  5. Render the employee's recent attendance logs dynamically in the portal table.
- **Deliverables & Timeline:**
  - *Tuesday 18:00:* `api.js` request module with sample calls.
  - *Wednesday 16:00:* End-to-end integration between UI buttons, GPS coords, and backend attendance API.
  - *Thursday 09:30:* Visual toast feedback polishing and state persistence testing.
- **Acceptance Criteria:**
  - Smooth user experience with loading spinners during GPS acquisition and API calls.
  - Clear success notifications on clock-in with recorded time and distance.

---

### 7. Talabi Josiah
- **Role:** Backend Authentication & Employee Engineer
- **Assigned Files:** `backend/routers/auth.py`, `backend/routers/employees.py`, `backend/schemas.py`
- **Key Responsibilities:**
  1. Define Pydantic request and response models for employees, auth tokens/PINs, and responses.
  2. Implement employee directory endpoints:
     - `GET /api/employees`: list active staff members.
     - `POST /api/employees`: register new employee.
     - `GET /api/employees/{id}`: get employee details and department.
  3. Implement PIN verification endpoint `POST /api/auth/verify-pin` to prevent unauthorized clock-ins.
- **Deliverables & Timeline:**
  - *Tuesday 18:00:* Pydantic schemas in `schemas.py` and employee routes in `employees.py`.
  - *Wednesday 14:00:* PIN verification route and session validation.
  - *Thursday 09:30:* Input validation audit (sanitize inputs, handle missing fields).
- **Acceptance Criteria:**
  - Endpoints return standard HTTP status codes and informative JSON error bodies.
  - Fast response time (< 50ms) using SQLite indexed queries.

---

### 8. Oluwasegun Adejumo
- **Role:** Backend Admin & Analytics Engineer
- **Assigned Files:** `backend/routers/admin.py`, `backend/services/reports.py`
- **Key Responsibilities:**
  1. Implement workplace geofence configuration endpoints:
     - `GET /api/admin/geofence`: retrieve current office coordinates and radius.
     - `PUT /api/admin/geofence`: update office coordinates and radius dynamically.
  2. Build attendance aggregation analytics service:
     - Total staff count, staff clocked in today, staff clocked out, and late arrivals (arrival after 09:00 AM).
  3. Implement attendance export endpoint (`GET /api/admin/export/csv` and JSON query filters).
- **Deliverables & Timeline:**
  - *Tuesday 18:00:* Geofence setting CRUD endpoint in `admin.py`.
  - *Wednesday 15:00:* Reporting calculation logic (present, late, absent counts) and CSV stream generator.
  - *Thursday 09:30:* Verification of report filtering by custom date ranges.
- **Acceptance Criteria:**
  - Admin can update workplace latitude/longitude on the fly; new coordinates take effect immediately.
  - Attendance report calculates accurate daily summary numbers.

---

### 9. Olajide Peter
- **Role:** Admin Dashboard Frontend Developer
- **Assigned Files:** `frontend/admin.html`, `frontend/js/admin.js`, `frontend/css/admin.css`
- **Key Responsibilities:**
  1. Build an executive Admin Dashboard interface (`admin.html`) matching the project design system.
  2. Implement KPI summary stat cards:
     - Total Employees, Clocked In Today, Late Arrivals, Outside Boundary Attempts.
  3. Build an interactive Geofence Settings Form allowing admins to view and update:
     - Workplace Name, Latitude, Longitude, and Allowed Radius in meters.
     - Include a button to auto-fill current admin GPS location as the office location.
  4. Build a comprehensive attendance data table with search by employee name and date filter.
  5. Wire "Export to CSV" button to download attendance records.
- **Deliverables & Timeline:**
  - *Tuesday 18:00:* Complete markup and styling for `admin.html` and `admin.css`.
  - *Wednesday 16:00:* Connect admin dashboard to admin API endpoints (KPI cards, table, and geofence form).
  - *Thursday 09:30:* CSV download functionality and end-to-end admin UI test.
- **Acceptance Criteria:**
  - Admin can change workplace coordinates directly from the UI and see instant confirmation.
  - Live attendance table displays real-time employee clock-in and clock-out logs.

---

## ⏱️ Daily Checkpoint Schedule

```
+-------------------------------------------------------------------------------+
| Checkpoint              | Time              | Agenda                          |
+-------------------------------------------------------------------------------+
| Day 1 Kickoff           | Tuesday 12:00 PM  | Scaffold review & task handoff  |
| Day 1 Progress Standup  | Tuesday 17:30 PM  | Module review & blocker removal |
| Day 2 Morning Sync      | Wednesday 09:00 AM| Frontend-backend contract check |
| Day 2 Integration Demo  | Wednesday 17:30 PM| End-to-end flow dry run         |
| Day 3 Final Polish      | Thursday 09:00 AM | Bug triage & demo data check    |
| Code Freeze             | Thursday 11:30 AM | No new commits; demo ready      |
| Project Showcase        | Thursday 12:00 PM | Formal project demonstration    |
+-------------------------------------------------------------------------------+
```
