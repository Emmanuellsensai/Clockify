import sqlite3
from datetime import datetime
from backend.config import DB_PATH, DEFAULT_WORKPLACE, get_now

_db_initialized = False

def init_db():
    global _db_initialized
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. Employees Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            staff_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            department TEXT NOT NULL,
            pin TEXT DEFAULT '1234',
            is_admin INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """)

    # Ensure is_admin column exists for existing databases
    cursor.execute("PRAGMA table_info(employees)")
    columns = [col[1] for col in cursor.fetchall()]
    if "is_admin" not in columns:
        cursor.execute("ALTER TABLE employees ADD COLUMN is_admin INTEGER DEFAULT 0")

    # 2. Workplace Geofence Settings Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS geofence_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            radius_meters REAL NOT NULL,
            work_start_time TEXT DEFAULT '09:00',
            updated_at TEXT NOT NULL
        )
    """)

    # 3. Attendance Records Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS attendance_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            clock_in_time TEXT,
            clock_in_lat REAL,
            clock_in_lon REAL,
            clock_in_distance REAL,
            clock_out_time TEXT,
            clock_out_lat REAL,
            clock_out_lon REAL,
            clock_out_distance REAL,
            status TEXT NOT NULL,
            is_late INTEGER DEFAULT 0,
            notes TEXT,
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        )
    """)

    conn.commit()

    # Seed Default Geofence if table is empty
    cursor.execute("SELECT COUNT(*) FROM geofence_settings")
    if cursor.fetchone()[0] == 0:
        now = get_now().isoformat()
        cursor.execute("""
            INSERT INTO geofence_settings (name, latitude, longitude, radius_meters, work_start_time, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            DEFAULT_WORKPLACE["name"],
            DEFAULT_WORKPLACE["latitude"],
            DEFAULT_WORKPLACE["longitude"],
            DEFAULT_WORKPLACE["radius_meters"],
            DEFAULT_WORKPLACE["work_start_time"],
            now
        ))
        conn.commit()

    # Seed Sample Employees if table is empty
    cursor.execute("SELECT COUNT(*) FROM employees")
    if cursor.fetchone()[0] == 0:
        now = get_now().isoformat()
        initial_employees = [
            ("EMP001", "Arogundade Habeebat", "habeebat@clockify.local", "Frontend Engineering", "1234", 0),
            ("EMP002", "Jonathan Jeremiah", "jeremiah@clockify.local", "Frontend & Mobile", "1234", 0),
            ("EMP003", "Usang Emmanuel", "usang@clockify.local", "Backend & Database", "1234", 0),
            ("EMP004", "Babatunde Daniel", "daniel@clockify.local", "Backend & Geolocation", "1234", 0),
            ("EMP005", "Ojomo Abiola", "abiola@clockify.local", "Frontend & Integration", "1234", 0),
            ("EMP006", "Talabi Josiah", "josiah@clockify.local", "Backend & Security", "1234", 0),
            ("EMP007", "Oluwasegun Adejumo", "adejumo@clockify.local", "Analytics & Admin", "1234", 0),
            ("EMP008", "Olajide Peter", "peter@clockify.local", "Frontend & Admin UI", "1234", 0),
            ("EMP009", "techAlhaji", "techalhaji@clockify.dev", "Lead Tech / Engineering Leadership", "1234", 1),
            ("EMP010", "Amina Bello", "amina@clockify.local", "Operations & Quality Assurance", "1234", 0),
        ]
        cursor.executemany("""
            INSERT INTO employees (staff_id, name, email, department, pin, is_admin, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [(emp[0], emp[1], emp[2], emp[3], emp[4], emp[5], now) for emp in initial_employees])
        conn.commit()
    else:
        # Ensure techAlhaji is updated as Lead Tech in existing database
        cursor.execute("""
            UPDATE employees 
            SET name = 'techAlhaji', 
                email = 'techalhaji@clockify.dev', 
                department = 'Lead Tech / Engineering Leadership', 
                is_admin = 1 
            WHERE staff_id = 'EMP009' OR name = 'Lead Tech' OR id = 9
        """)
        # Ensure EMP010 exists for 10-employee team testing
        cursor.execute("SELECT COUNT(*) FROM employees WHERE staff_id = 'EMP010'")
        if cursor.fetchone()[0] == 0:
            now_iso = get_now().isoformat()
            cursor.execute("""
                INSERT INTO employees (staff_id, name, email, department, pin, is_admin, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, ("EMP010", "Amina Bello", "amina@clockify.local", "Operations & Quality Assurance", "1234", 0, now_iso))
        conn.commit()

    conn.close()
    _db_initialized = True

def get_db():
    global _db_initialized
    if not _db_initialized:
        try:
            test_conn = sqlite3.connect(DB_PATH, check_same_thread=False)
            cursor = test_conn.cursor()
            cursor.execute("SELECT 1 FROM employees LIMIT 1")
            test_conn.close()
            _db_initialized = True
        except Exception:
            init_db()

    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn
