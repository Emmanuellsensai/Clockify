"""
Attendance analytics & export service.

Powers the admin dashboard KPIs and export endpoints:
- Daily summary metrics (total staff, present, clocked in/out, late, absent)
- Custom date-range aggregation reports
- Filtered CSV streaming export and JSON export

"Late" is determined by the ``is_late`` flag stamped on each record at
clock-in time, relative to the configured workplace ``work_start_time``
(default 09:00).
"""
import io
import csv
from datetime import datetime
from typing import Any, Dict, Iterator, List, Optional, Tuple

from backend.database import get_db

DATE_FORMAT = "%Y-%m-%d"
CSV_HEADER = [
    "Record ID", "Staff ID", "Employee Name", "Department", "Date",
    "Clock In Time", "Clock In Distance (m)", "Clock Out Time",
    "Clock Out Distance (m)", "Status", "Late"
]

VALID_STATUSES = ("CLOCKED_IN", "CLOCKED_OUT")


# ---------------------------------------------------------------------------
# Date helpers / validation
# ---------------------------------------------------------------------------

def validate_date(value: Optional[str], field_name: str = "date") -> Optional[str]:
    """Validate that ``value`` is a YYYY-MM-DD string. Returns the value or None."""
    if value is None or value == "":
        return None
    try:
        datetime.strptime(value, DATE_FORMAT)
    except ValueError:
        raise ValueError(f"Invalid {field_name} '{value}'. Expected format: YYYY-MM-DD")
    return value


def validate_date_range(
    start_date: Optional[str],
    end_date: Optional[str]
) -> Tuple[Optional[str], Optional[str]]:
    """
    Validate an inclusive custom date range.
    - Both values must be YYYY-MM-DD.
    - start_date must not be after end_date.
    If only one bound is supplied it is treated as a single-day range.
    """
    start = validate_date(start_date, "start_date")
    end = validate_date(end_date, "end_date")

    if start and end and start > end:
        raise ValueError(f"start_date '{start}' must not be after end_date '{end}'")

    if start and not end:
        end = start
    if end and not start:
        start = end

    return start, end


# ---------------------------------------------------------------------------
# Shared attendance filter builder
# ---------------------------------------------------------------------------

def build_attendance_query(
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    employee_id: Optional[int] = None,
    department: Optional[str] = None,
    status: Optional[str] = None,
    late_only: bool = False,
    search: Optional[str] = None
) -> Tuple[str, List[Any]]:
    """
    Build a parameterized WHERE clause over attendance_records joined with
    employees. Returns (sql_fragment_including_where, params).
    """
    conditions = ["1=1"]
    params: List[Any] = []

    if date:
        conditions.append("a.date = ?")
        params.append(date)

    if start_date:
        conditions.append("a.date >= ?")
        params.append(start_date)

    if end_date:
        conditions.append("a.date <= ?")
        params.append(end_date)

    if employee_id is not None:
        conditions.append("a.employee_id = ?")
        params.append(employee_id)

    if department:
        conditions.append("LOWER(e.department) = LOWER(?)")
        params.append(department)

    if status:
        conditions.append("a.status = ?")
        params.append(status)

    if late_only:
        conditions.append("COALESCE(a.is_late, 0) = 1")

    if search:
        conditions.append("(e.name LIKE ? OR e.staff_id LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%"])

    return " AND ".join(conditions), params


def fetch_attendance_records(
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    employee_id: Optional[int] = None,
    department: Optional[str] = None,
    status: Optional[str] = None,
    late_only: bool = False,
    search: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Retrieve attendance records (with employee details) matching the given
    filters. Used by the JSON export and the admin records endpoint.
    """
    where_clause, params = build_attendance_query(
        date=date, start_date=start_date, end_date=end_date,
        employee_id=employee_id, department=department, status=status,
        late_only=late_only, search=search
    )

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(f"""
        SELECT a.id, a.employee_id, e.staff_id, e.name, e.department, a.date,
               a.clock_in_time, a.clock_in_lat, a.clock_in_lon, a.clock_in_distance,
               a.clock_out_time, a.clock_out_lat, a.clock_out_lon, a.clock_out_distance,
               a.status, COALESCE(a.is_late, 0) AS is_late, a.notes
        FROM attendance_records a
        JOIN employees e ON a.employee_id = e.id
        WHERE {where_clause}
        ORDER BY a.date DESC, a.clock_in_time DESC
    """, tuple(params))
    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# Analytics: daily summary
# ---------------------------------------------------------------------------

def generate_daily_report(date_str: Optional[str] = None) -> Dict[str, Any]:
    """
    Compute daily attendance metrics for the given date (default: today).
    Late arrivals are records stamped late at clock-in (arrival after the
    configured work start time, default 09:00).
    """
    if not date_str:
        date_str = datetime.now().strftime(DATE_FORMAT)

    conn = get_db()
    cursor = conn.cursor()

    # Total employees on staff
    cursor.execute("SELECT COUNT(*) FROM employees")
    total_employees = cursor.fetchone()[0]

    # Attendance rows for the requested date
    cursor.execute("""
        SELECT COALESCE(a.is_late, 0) AS is_late, a.status
        FROM attendance_records a
        WHERE a.date = ?
    """, (date_str,))
    records = cursor.fetchall()
    conn.close()

    total_present = len(records)
    clocked_in_now = sum(1 for r in records if r["status"] == "CLOCKED_IN")
    clocked_out = sum(1 for r in records if r["status"] == "CLOCKED_OUT")
    late_arrivals = sum(1 for r in records if r["is_late"] == 1)
    absent = max(0, total_employees - total_present)

    return {
        "date": date_str,
        "total_employees": total_employees,
        "total_present": total_present,
        "clocked_in_now": clocked_in_now,
        "clocked_out": clocked_out,
        "late_arrivals": late_arrivals,
        "absent": absent
    }


# ---------------------------------------------------------------------------
# Analytics: custom date-range summary
# ---------------------------------------------------------------------------

def generate_range_report(start_date: str, end_date: str) -> Dict[str, Any]:
    """
    Aggregate attendance metrics across an inclusive custom date range.

    - total_present: distinct staff with at least one attendance record.
    - present_days: total attendance records (employee-days present).
    - clocked_in_now / clocked_out / late_arrivals: record counts.
    - absent: employee-days without a record (total_employees * days - records).
    """
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM employees")
    total_employees = cursor.fetchone()[0]

    cursor.execute("""
        SELECT employee_id,
               COALESCE(is_late, 0) AS is_late,
               status
        FROM attendance_records
        WHERE date >= ? AND date <= ?
    """, (start_date, end_date))
    rows = cursor.fetchall()
    conn.close()

    days = (datetime.strptime(end_date, DATE_FORMAT) -
            datetime.strptime(start_date, DATE_FORMAT)).days + 1

    distinct_staff_present = len({r["employee_id"] for r in rows})
    total_records = len(rows)
    clocked_in_now = sum(1 for r in rows if r["status"] == "CLOCKED_IN")
    clocked_out = sum(1 for r in rows if r["status"] == "CLOCKED_OUT")
    late_arrivals = sum(1 for r in rows if r["is_late"] == 1)
    absent_employee_days = max(0, total_employees * days - total_records)

    return {
        "start_date": start_date,
        "end_date": end_date,
        "days": days,
        "total_employees": total_employees,
        "total_present": distinct_staff_present,
        "present_days": total_records,
        "clocked_in_now": clocked_in_now,
        "clocked_out": clocked_out,
        "late_arrivals": late_arrivals,
        "absent": absent_employee_days
    }


# ---------------------------------------------------------------------------
# Export: CSV stream generator
# ---------------------------------------------------------------------------

def _format_csv_row(row: Dict[str, Any]) -> List[Any]:
    return [
        row["id"],
        row["staff_id"],
        row["name"],
        row["department"],
        row["date"],
        row["clock_in_time"] or "N/A",
        row["clock_in_distance"] if row["clock_in_distance"] is not None else "N/A",
        row["clock_out_time"] or "N/A",
        row["clock_out_distance"] if row["clock_out_distance"] is not None else "N/A",
        row["status"],
        "YES" if row["is_late"] else "NO"
    ]


def stream_attendance_csv(**filters: Any) -> Iterator[str]:
    """
    Generator that yields the CSV export line-by-line so large reports can be
    streamed without buffering the whole document in memory.
    Accepts the same keyword filters as fetch_attendance_records().
    """
    buffer = io.StringIO()
    writer = csv.writer(buffer)

    writer.writerow(CSV_HEADER)
    yield buffer.getvalue()
    buffer.seek(0)
    buffer.truncate(0)

    for row in fetch_attendance_records(**filters):
        writer.writerow(_format_csv_row(row))
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)


def export_attendance_csv(**filters: Any) -> str:
    """Return the complete CSV export as a single string."""
    return "".join(stream_attendance_csv(**filters))


# ---------------------------------------------------------------------------
# Export: JSON
# ---------------------------------------------------------------------------

def export_attendance_json(**filters: Any) -> Dict[str, Any]:
    """
    Return attendance records matching the filters as a JSON-ready payload
    with metadata about the applied filters.
    """
    records = fetch_attendance_records(**filters)
    applied_filters = {
        key: value for key, value in filters.items()
        if value not in (None, False, "")
    }
    return {
        "exported_at": datetime.now().isoformat(),
        "count": len(records),
        "filters": applied_filters,
        "records": records
    }
