# Clockify — Digital Geofenced Attendance System

Clockify is a digital attendance system that allows employees to clock in and clock out using their personal mobile or desktop devices upon arriving at and leaving their workplace. It uses high-accuracy GPS and the Haversine formula to verify an employee's physical location against a configured workplace geofence perimeter before logging their arrival time and punctuality.

---

## 🚀 Key Features

- **📍 GPS Geofence Verification:** Calculates real-time distance in meters using device geolocation. Clock-ins are permitted only within the verified perimeter (e.g., 150m radius).
- **⏱️ Live Digital Clock & Punctuality Engine:** Automatically tags arrivals after shift start time (e.g., 09:00 AM) as *Late*.
- **📱 Zero-Friction Mobile Web Experience:** Pure HTML5, CSS3, and Vanilla JavaScript with mobile-first responsive design, dark mode, and glassmorphism.
- **🛡️ Shift Integrity:** Prevents duplicate clock-ins, enforces clock-out before starting a new shift, and records departure times and distances.
- **⚙️ Executive Admin Dashboard:** Real-time KPI counters (Total Staff, Present, Clocked In Now, Late, Absent), interactive workplace coordinate management, live searchable logs, and one-click CSV export.
- **⚡ Unified Single-Command Runner:** Boots FastAPI backend, SQLite database with automated seed data, and static frontend on a single port.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | HTML5 (Semantic), CSS3 (Modern Vanilla Design System, Glassmorphic Cards), Vanilla JavaScript (ES6+ Modules, Geolocation API) |
| **Backend** | Python 3, FastAPI, Uvicorn, Pydantic |
| **Database** | SQLite (Thread-safe, built-in, zero external driver setup) |
| **Math / Geolocation** | Haversine Formula for great-circle distance computation in meters |

---

## 👥 Team & Task Assignments (Sprint: Oct 13 – Oct 15, 12:00 PM)

| Member | Role | Assigned Modules & Files |
|---|---|---|
| **Tech Lead (You)** | Project Architect & Orchestrator | `run.py`, `backend/main.py`, Architecture, Git Reviews |
| **Arogundade Habeebat** | Frontend UI/UX Developer | `frontend/index.html`, `frontend/css/style.css` |
| **Jonathan Jeremiah** | Geolocation Specialist | `frontend/js/geo.js` (HTML5 GPS client & distance math) |
| **Usang Emmanuel** | Backend Database Engineer | `backend/database.py`, `backend/models.py`, `backend/config.py` |
| **Babatunde Daniel** | Geofencing & Attendance Engine | `backend/services/geofence.py`, `backend/routers/attendance.py` |
| **Ojomo Abiola** | Frontend State & API Integrator | `frontend/js/api.js`, `frontend/js/app.js` |
| **Talabi Josiah** | Auth & Employee Engineer | `backend/routers/auth.py`, `backend/routers/employees.py`, `backend/schemas.py` |
| **Oluwasegun Adejumo** | Backend Admin & Analytics | `backend/routers/admin.py`, `backend/services/reports.py` |
| **Olajide Peter** | Admin Frontend Developer | `frontend/admin.html`, `frontend/js/admin.js`, `frontend/css/admin.css` |

*For complete milestones and detailed task acceptance criteria, consult [TEAM_TASKS.md](file:///c:/Users/ICT%20LASIEC/Clockify/TEAM_TASKS.md) and [ROADMAP.md](file:///c:/Users/ICT%20LASIEC/Clockify/ROADMAP.md).*

---

## 📁 Project Directory Structure

```
Clockify/
├── README.md                   # Project overview & documentation
├── ROADMAP.md                  # Detailed sprint roadmap (Oct 13 - Oct 15, 12 PM)
├── TEAM_TASKS.md               # Individual member task assignments & timelines
├── requirements.txt            # Python dependencies
├── run.py                      # Single-command server starter
├── clockify.db                 # Auto-generated SQLite database
├── backend/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application & route mounting
│   ├── config.py               # Geofence defaults & constants
│   ├── database.py             # SQLite setup & employee seed data
│   ├── models.py               # Database record dictionary converters
│   ├── schemas.py              # Pydantic request/response models
│   ├── services/
│   │   ├── __init__.py
│   │   ├── geofence.py         # Haversine distance algorithm & verification
│   │   └── reports.py          # Daily metrics aggregation & CSV export
│   └── routers/
│       ├── __init__.py
│       ├── auth.py             # PIN & credential verification
│       ├── employees.py        # Employee registration & listing
│       ├── attendance.py       # Clock-in, Clock-out & status endpoints
│       └── admin.py            # Geofence coordinates, metrics & CSV export
└── frontend/
    ├── index.html              # Employee clock-in/out portal
    ├── admin.html              # Admin management dashboard
    ├── css/
    │   ├── style.css           # Core design system & employee styles
    │   └── admin.css           # Admin KPI cards & data table styles
    └── js/
        ├── api.js              # Centralized backend HTTP client
        ├── geo.js              # HTML5 Geolocation client & radar calculator
        ├── app.js              # Employee portal controller
        └── admin.js            # Admin dashboard controller
```

---

## 🏁 Quickstart Guide

### 1. Prerequisites
- Python 3.10+ installed.

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run Application
```bash
python run.py
```

### 4. Access the Application
- **Employee Clock-in Portal:** [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Admin Management Portal:** [http://127.0.0.1:8000/admin](http://127.0.0.1:8000/admin)
- **Interactive Swagger API Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 🧪 Testing the Geofence Flow

1. Open [http://127.0.0.1:8000/admin](http://127.0.0.1:8000/admin).
2. Click **"🎯 Use My Current Device GPS"** to automatically populate your current coordinates as the office location, then click **"💾 Save Geofence Settings"**.
3. Navigate to [http://127.0.0.1:8000/](http://127.0.0.1:8000/) on your browser or mobile device on the same local network.
4. Allow Location Permissions when prompted.
5. Notice the radar badge change to **"Inside Workplace"** with your calculated distance (e.g. `4m away`).
6. Click **"Clock In Now"**. Your attendance, timestamp, and punctuality are logged!
7. Return to the Admin Portal to view your real-time log, summary metrics, or export to CSV.