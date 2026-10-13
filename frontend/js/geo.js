/**
 * Clockify — Geolocation & Geofencing Client (geo.js)
 * HTML5 Geolocation API wrapper with accuracy verification and distance math
 */

const GeoService = {
  // Calculate geodesic distance using Haversine formula on client
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // meters
    const toRad = deg => (deg * Math.PI) / 180;
    
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
      
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  },

  // Get current device position with high accuracy
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        return reject(new Error("Geolocation is not supported by your browser or device."));
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      };

      navigator.geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: Math.round(position.coords.accuracy),
            timestamp: position.timestamp
          });
        },
        error => {
          let message = "Unable to retrieve device location.";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = "Location permission denied. Please allow GPS access in your browser settings.";
              break;
            case error.POSITION_UNAVAILABLE:
              message = "GPS location signal unavailable. Ensure your device location is toggled ON.";
              break;
            case error.TIMEOUT:
              message = "GPS request timed out. Please try again in an area with clear signal.";
              break;
          }
          reject(new Error(message));
        },
        options
      );
    });
  },

  // Continuous location watcher
  watchPosition(callback, errorCallback) {
    if (!("geolocation" in navigator)) {
      if (errorCallback) errorCallback(new Error("Geolocation not supported"));
      return null;
    }

    return navigator.geolocation.watchPosition(
      pos => {
        callback({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy)
        });
      },
      err => {
        if (errorCallback) errorCallback(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 3000
      }
    );
  }
};
