import math
from typing import Tuple, Dict, Any

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees) using the Haversine formula.
    Returns distance in meters.
    """
    # Earth radius in meters
    EARTH_RADIUS_METERS = 6371000.0

    # Convert decimal degrees to radians
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    # Haversine formula
    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    distance = EARTH_RADIUS_METERS * c

    return round(distance, 2)

def verify_geofence(
    user_lat: float, 
    user_lon: float, 
    office_lat: float, 
    office_lon: float, 
    allowed_radius: float,
    gps_accuracy: float = None
) -> Dict[str, Any]:
    """
    Verify if user coordinates are within the allowed workplace radius.
    """
    distance = haversine_distance(user_lat, user_lon, office_lat, office_lon)
    is_inside = distance <= allowed_radius

    return {
        "is_inside": is_inside,
        "distance_meters": distance,
        "allowed_radius_meters": allowed_radius,
        "gps_accuracy_meters": gps_accuracy,
        "difference_meters": round(distance - allowed_radius, 2) if not is_inside else 0.0
    }
