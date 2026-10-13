import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent.parent

# On Vercel / serverless runtimes, root filesystem is read-only except /tmp
if os.environ.get("VERCEL"):
    DB_PATH = "/tmp/clockify.db"
else:
    DB_PATH = os.path.join(BASE_DIR, "clockify.db")

FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

# Default Workplace Geofence (Can be updated dynamically via Admin API)
DEFAULT_WORKPLACE = {
    "name": "Headquarters - Main Campus",
    "latitude": 6.5244,       # Default sample coordinates (e.g., Lagos, Nigeria)
    "longitude": 3.3792,
    "radius_meters": 150.0,   # Allowed perimeter in meters
    "work_start_time": "09:00" # After 09:00 is marked Late
}

# Geolocation Accuracy Threshold
MAX_ALLOWED_GPS_ACCURACY_METERS = 80.0
