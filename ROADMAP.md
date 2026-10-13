# Clockify — Digital Geofenced Attendance System
## Project Roadmap & Sprint Schedule

**Project Duration:** Tuesday, 13th October 2026 – Thursday, 15th October 2026 (12:00 PM Deadline)  
**Team Composition:** 9 Members (Tech Lead + 8 Developers)  
**Core Stack:** HTML5, CSS3, Vanilla JavaScript (Frontend) | Python, FastAPI, SQLite (Backend)

---

## 🎯 Project Objectives & Vision
1. **Accurate Geofenced Clock-in/Clock-out:** Verify employee proximity using device GPS (Haversine formula within workplace radius) before allowing attendance logging.
2. **Zero-Friction Mobile Experience:** Fast, responsive web application runnable on any mobile or desktop browser without app store installation.
3. **Transparent Reporting & Administration:** Real-time visibility into employee arrival times, late-arrival markers, departure times, and geofence boundary administration.
4. **Resilient & Modular Codebase:** Clean separation of concerns between UI, Geolocation services, Database models, and API endpoints to enable parallel development for 9 team members.

---

## 📅 Sprint Timeline & Milestones

```
+----------------------------------------------------------------------------------------------------+
|  TUESDAY, OCT 13                 |  WEDNESDAY, OCT 14               |  THURSDAY, OCT 15 (12 PM)     |
|----------------------------------+----------------------------------+-------------------------------|
|  Phase 1 (Morning): Scaffolding  |  Phase 3 (Morning): Full Flow    |  Phase 5 (Morning): Final QA  |
|  Phase 2 (Afternoon): Modules    |  Phase 4 (Afternoon): Edge Cases |  11:30 AM: Code Freeze        |
|  17:30 Checkpoint: Standup & Sync|  17:30 Checkpoint: Integration   |  12:00 PM: Project Demo       |
+----------------------------------------------------------------------------------------------------+
```

---

### Phase 1: Foundation & Scaffold Setup
**Tuesday, Oct 13 | 09:00 - 13:00**
- [x] Project workspace scaffolding (folder structure, clean separation of backend & frontend).
- [x] Tech Lead alignment: Establish Git branching model (`main`, `develop`, feature branches `feature/<name>`).
- [x] Define API contracts (`/api/attendance`, `/api/admin`, `/api/employees`) and shared data schemas.
- [x] Initialize baseline SQLite database and seed employee profiles.
- [x] Distribute sprint task matrix to all 9 team members.

---

### Phase 2: Core Module Implementation (Parallel Sprint)
**Tuesday, Oct 13 | 14:00 - 18:30**
- **Frontend Stream:**
  - Build mobile-first Clock-In portal layout with real-time digital clock and dynamic status indicators.
  - Implement HTML5 Geolocation API client with accuracy checks and GPS permission prompts.
  - Establish styling system (dark mode, glassmorphism, responsive cards, toast feedback).
- **Backend Stream:**
  - Implement SQLite database schemas: `employees`, `attendance_records`, `geofence_settings`.
  - Implement Haversine formula calculation for geodesic distance check in `geofence.py`.
  - Build endpoints for employee lookup, clock-in, clock-out, and daily history retrieval.
- **Checkpoint Sync (17:30 - 18:00):** Review progress, identify blockers, verify API schemas.

---

### Phase 3: Integration & Admin Suite
**Wednesday, Oct 14 | 09:00 - 13:00**
- Wire client-side API calls to Python backend:
  - Submit high-precision coordinates `(lat, lon)` on Clock-In and Clock-Out button click.
  - Receive backend verification responses (Success vs. Outside Workplace Radius).
- Build Admin Management Dashboard:
  - Dynamic geofence coordinates & radius editor (default 150m workplace perimeter).
  - Live attendance log view with filtering (Date, Employee ID, Status).
  - Summary metrics: Staff Present, Clocked Out, Late Arrival (>09:00 AM), Out of Bounds attempts.

---

### Phase 4: Edge Cases, Hardening & Security
**Wednesday, Oct 14 | 14:00 - 18:30**
- **GPS Integrity & Fallbacks:**
  - Handle GPS permission denials and timeout retries.
  - Reject poor accuracy readings (accuracy threshold > 60m rejected with prompt to enable high accuracy).
  - Reject duplicate clock-ins within the same shift.
- **UI Polish:**
  - Add live radar/distance-to-office counter (e.g., *"You are 24 meters from office - Inside Geofence"*).
  - Add CSV export for Admin attendance logs.
- **Integration Test Checkpoint (17:30 - 18:00):** Full end-to-end rehearsal on mobile browsers and desktop.

---

### Phase 5: Final QA, Demo Preparation & Delivery
**Thursday, Oct 15 | 08:30 - 12:00 PM**
- **08:30 - 10:00:** Comprehensive regression testing across devices; verify edge cases (out-of-bounds clock-in attempt, late arrival tagging).
- **10:00 - 11:00:** Populate realistic demonstration data (attendance records across multiple days/departments).
- **11:00 - 11:30:** Code freeze, README documentation updates, final review of deliverables.
- **11:30 - 12:00:** Live project walkthrough and presentation.

---

## 🛠️ Definition of Done (DoD)
1. An employee can open the web app on their phone, grant GPS permission, and see their real-time distance from the office.
2. Clicking **"Clock In"** inside the office radius logs their arrival time and marks their attendance status.
3. Clicking **"Clock In"** outside the office radius returns an informative refusal message with the measured distance.
4. An employee can click **"Clock Out"** at the end of their shift with recorded departure time and hours worked.
5. Admin portal allows viewing all employee attendance records, exporting to CSV, and modifying office coordinates.
6. The entire project runs with a single command: `python run.py`.
