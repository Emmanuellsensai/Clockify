"""
Clockify — Unified Database Layer
Dual Engine: High-concurrency SQLite (with WAL mode & busy timeout) and PostgreSQL (via pg8000).
Ensures permanent multi-device synchronization and zero record fluctuation.
"""
import os
import re
import ssl
import sqlite3
import urllib.parse
from datetime import datetime
from dotenv import load_dotenv

from backend.config import DB_PATH, DEFAULT_WORKPLACE, get_now

# Automatically load environment variables from .env
load_dotenv()

# Check for PostgreSQL connection URL (e.g. Neon, Supabase, Vercel Postgres)
DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL") or os.environ.get("POSTGRES_PRISMA_URL")
IS_POSTGRES = bool(DATABASE_URL and (DATABASE_URL.startswith("postgres://") or DATABASE_URL.startswith("postgresql://")))

_db_initialized = False


# ---------------------------------------------------------------------------
# PostgreSQL Adapter & Wrapper (using pg8000)
# ---------------------------------------------------------------------------

class DictRow(dict):
    """Row object that supports both dictionary key access (row['name']) and index access (row[0])."""
    def __init__(self, cols, vals):
        super().__init__(zip(cols, vals))
        self._vals = tuple(vals)

    def __getitem__(self, item):
        if isinstance(item, int):
            return self._vals[item]
        return super().__getitem__(item)


class PgCursorWrapper:
    """Wraps a pg8000 cursor to mimic sqlite3 cursor API with automatic ? -> %s placeholder translation."""
    def __init__(self, cursor):
        self._cursor = cursor
        self.lastrowid = None

    def execute(self, sql, params=None):
        pg_sql = sql.replace("?", "%s")
        stripped = pg_sql.strip().rstrip(";")
        is_insert = stripped.upper().startswith("INSERT INTO") and "RETURNING" not in stripped.upper()

        if is_insert:
            pg_sql = stripped + " RETURNING id"

        if params is not None:
            self._cursor.execute(pg_sql, tuple(params))
        else:
            self._cursor.execute(pg_sql)

        if is_insert:
            try:
                row = self._cursor.fetchone()
                if row:
                    self.lastrowid = row[0]
            except Exception:
                pass
        return self

    def executemany(self, sql, seq_of_params):
        pg_sql = sql.replace("?", "%s")
        self._cursor.executemany(pg_sql, seq_of_params)
        return self

    def fetchone(self):
        row = self._cursor.fetchone()
        if row is None:
            return None
        if not self._cursor.description:
            return row
        cols = [col[0] for col in self._cursor.description]
        return DictRow(cols, row)

    def fetchall(self):
        rows = self._cursor.fetchall()
        if not rows or not self._cursor.description:
            return [DictRow([], r) for r in rows] if rows else []
        cols = [col[0] for col in self._cursor.description]
        return [DictRow(cols, r) for r in rows]

    def close(self):
        self._cursor.close()

    @property
    def rowcount(self):
        return self._cursor.rowcount


class PgConnectionWrapper:
    """Wraps a pg8000 connection."""
    def __init__(self, conn):
        self._conn = conn

    def cursor(self):
        return PgCursorWrapper(self._conn.cursor())

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


def _connect_postgres():
    """Establishes connection to PostgreSQL using pg8000 with SSL support."""
    import pg8000.dbapi
    parsed = urllib.parse.urlparse(DATABASE_URL)
    user = urllib.parse.unquote(parsed.username or "postgres")
    password = urllib.parse.unquote(parsed.password or "")
    host = parsed.hostname or "localhost"
    port = parsed.port or 5432
    database = parsed.path.lstrip("/") or "postgres"

    ssl_context = None
    query_params = urllib.parse.parse_qs(parsed.query)
    sslmode = query_params.get("sslmode", [""])[0]
    if sslmode in ("require", "verify-ca", "verify-full") or host not in ("localhost", "127.0.0.1"):
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE

    raw_conn = pg8000.dbapi.connect(
        user=user,
        password=password,
        host=host,
        port=port,
        database=database,
        ssl_context=ssl_context
    )
    return PgConnectionWrapper(raw_conn)


# ---------------------------------------------------------------------------
# SQLite Connection Helper (Optimized for Concurrency)
# ---------------------------------------------------------------------------

def _connect_sqlite():
    """Connects to SQLite with WAL mode, busy timeout, and thread safety."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0, check_same_thread=False)
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 30000;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn


# ---------------------------------------------------------------------------
# Core Database Lifecycle
# ---------------------------------------------------------------------------

def get_raw_connection():
    """Returns an active, configured database connection (PostgreSQL or SQLite)."""
    if IS_POSTGRES:
        return _connect_postgres()
    return _connect_sqlite()


def init_db():
    """Initializes tables, indexes, and default seeds."""
    global _db_initialized
    conn = get_raw_connection()
    cursor = conn.cursor()

    if IS_POSTGRES:
        # PostgreSQL Schema
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS employees (
                id SERIAL PRIMARY KEY,
                staff_id VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                department VARCHAR(255) NOT NULL,
                pin VARCHAR(50) DEFAULT '1234',
                is_admin INTEGER DEFAULT 0,
                created_at VARCHAR(100) NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS geofence_settings (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                latitude DOUBLE PRECISION NOT NULL,
                longitude DOUBLE PRECISION NOT NULL,
                radius_meters DOUBLE PRECISION NOT NULL,
                work_start_time VARCHAR(20) DEFAULT '09:00',
                updated_at VARCHAR(100) NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS attendance_records (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL REFERENCES employees(id),
                date VARCHAR(20) NOT NULL,
                clock_in_time VARCHAR(20),
                clock_in_lat DOUBLE PRECISION,
                clock_in_lon DOUBLE PRECISION,
                clock_in_distance DOUBLE PRECISION,
                clock_out_time VARCHAR(20),
                clock_out_lat DOUBLE PRECISION,
                clock_out_lon DOUBLE PRECISION,
                clock_out_distance DOUBLE PRECISION,
                status VARCHAR(50) NOT NULL,
                is_late INTEGER DEFAULT 0,
                notes TEXT
            )
        """)
        conn.commit()
    else:
        # SQLite Schema
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
        # Ensure is_admin column exists
        cursor.execute("PRAGMA table_info(employees)")
        columns = [col[1] for col in cursor.fetchall()]
        if "is_admin" not in columns:
            cursor.execute("ALTER TABLE employees ADD COLUMN is_admin INTEGER DEFAULT 0")

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

    # 1. Seed Default Geofence if table is empty
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

    # 2. Seed Initial 10-Member Staff Roster
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
        # Ensure techAlhaji has admin rights and correct branding
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
    """Dependency helper returning an active database connection."""
    global _db_initialized
    if not _db_initialized:
        try:
            conn = get_raw_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM employees LIMIT 1")
            conn.close()
            _db_initialized = True
        except Exception:
            init_db()

    return get_raw_connection()
