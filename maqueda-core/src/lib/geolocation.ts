interface GeolocationData {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export async function getGeolocationData(ipAddress?: string): Promise<GeolocationData> {
  try {
    // If no IP provided, return empty data
    if (!ipAddress) {
      return {};
    }

    // Use ip-api.com - free service, no API key required
    const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
    
    if (!response.ok) {
      console.warn(`Geolocation API request failed with status ${response.status}`);
      return {};
    }

    const data = await response.json();
    
    // Check if the response has the expected structure
    if (data.status !== 'success') {
      console.warn('Geolocation API returned non-success status:', data.message);
      return {};
    }

    return {
      country: data.country,
      region: data.regionName,
      city: data.city,
      latitude: data.lat,
      longitude: data.lon,
    };
  } catch (error) {
    console.error('Geolocation lookup failed:', error);
    return {};
  }
}