// fx/tools/weather.js
const axios = require('axios');

async function weatherFunction(request) {
  try {
    const { 
      location, 
      units = 'metric',
      forecast = false,
      days = 3,
      detailed = false
    } = request.data;
    
    if (!location) {
      return {
        success: false,
        error: {
          code: 'MISSING_LOCATION',
          message: 'Location is required (city name, zip code, or coordinates)'
        }
      };
    }

    // Get weather data
    const weatherData = await getWeatherData(location, units, forecast, days);
    
    if (!weatherData.found) {
      return {
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: `Location "${location}" not found`
        }
      };
    }

    return {
      success: true,
      result: {
        location: weatherData.location,
        current: weatherData.current,
        forecast: weatherData.forecast,
        units: weatherData.units,
        source: weatherData.source,
        formatted: formatWeatherResponse(weatherData, forecast, detailed)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'WEATHER_FAILED',
        message: error.message || 'Failed to get weather data'
      }
    };
  }
}

async function getWeatherData(location, units, forecast, days) {
  // Try multiple weather APIs
  const apiKey = process.env.WEATHER_API_KEY;
  
  if (apiKey) {
    try {
      // Try OpenWeatherMap API
      return await getOpenWeatherData(location, units, forecast, days, apiKey);
    } catch (error1) {
      console.log('OpenWeatherMap failed:', error1.message);
    }
  }
  
  try {
    // Try WeatherAPI.com
    const weatherApiKey = process.env.WEATHERAPI_KEY;
    if (weatherApiKey) {
      return await getWeatherAPIData(location, units, forecast, days, weatherApiKey);
    }
  } catch (error2) {
    console.log('WeatherAPI.com failed:', error2.message);
  }
  
  // Fallback to mock data
  return getMockWeatherData(location, units, forecast, days);
}

async function getOpenWeatherData(location, units, forecast, days, apiKey) {
  // First, geocode the location to get coordinates
  const geocodeUrl = `http://api.openweathermap.org/geo/1.0/direct`;
  
  const geocodeResponse = await axios.get(geocodeUrl, {
    params: {
      q: location,
      limit: 1,
      appid: apiKey
    },
    timeout: 10000
  });
  
  if (!geocodeResponse.data || geocodeResponse.data.length === 0) {
    throw new Error('Location not found');
  }
  
  const geoData = geocodeResponse.data[0];
  const { lat, lon, name, country, state } = geoData;
  
  // Get current weather
  const currentUrl = `https://api.openweathermap.org/data/2.5/weather`;
  
  const currentResponse = await axios.get(currentUrl, {
    params: {
      lat: lat,
      lon: lon,
      units: units,
      appid: apiKey,
      lang: 'en'
    },
    timeout: 10000
  });
  
  const currentData = currentResponse.data;
  
  // Parse current weather
  const currentWeather = {
    temperature: Math.round(currentData.main.temp),
    feelsLike: Math.round(currentData.main.feels_like),
    condition: currentData.weather[0].main,
    description: currentData.weather[0].description,
    icon: currentData.weather[0].icon,
    humidity: currentData.main.humidity,
    pressure: currentData.main.pressure,
    windSpeed: currentData.wind.speed,
    windDirection: currentData.wind.deg,
    visibility: currentData.visibility / 1000, // Convert to km
    clouds: currentData.clouds.all,
    sunrise: new Date(currentData.sys.sunrise * 1000).toLocaleTimeString(),
    sunset: new Date(currentData.sys.sunset * 1000).toLocaleTimeString(),
    timestamp: new Date().toISOString()
  };
  
  let forecastData = null;
  
  if (forecast) {
    // Get forecast
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast`;
    
    const forecastResponse = await axios.get(forecastUrl, {
      params: {
        lat: lat,
        lon: lon,
        units: units,
        appid: apiKey,
        cnt: days * 8 // 8 readings per day (3-hour intervals)
      },
      timeout: 10000
    });
    
    const forecastRaw = forecastResponse.data;
    
    // Parse forecast data
    forecastData = parseForecastData(forecastRaw, days, units);
  }
  
  return {
    found: true,
    location: {
      name: name,
      country: country,
      state: state,
      coordinates: { lat, lon }
    },
    current: currentWeather,
    forecast: forecastData,
    units: units === 'metric' ? '°C' : '°F',
    source: 'OpenWeatherMap'
  };
}

async function getWeatherAPIData(location, units, forecast, days, apiKey) {
  const url = `http://api.weatherapi.com/v1/${forecast ? 'forecast.json' : 'current.json'}`;
  
  const params = {
    key: apiKey,
    q: location,
    days: forecast ? days : 1,
    aqi: 'no',
    alerts: 'no'
  };
  
  const response = await axios.get(url, {
    params: params,
    timeout: 10000
  });
  
  const data = response.data;
  
  // Parse current weather
  const currentWeather = {
    temperature: Math.round(data.current.temp_c),
    feelsLike: Math.round(data.current.feelslike_c),
    condition: data.current.condition.text,
    description: data.current.condition.text,
    icon: `https:${data.current.condition.icon}`,
    humidity: data.current.humidity,
    pressure: data.current.pressure_mb,
    windSpeed: data.current.wind_kph / 3.6, // Convert to m/s
    windDirection: data.current.wind_degree,
    visibility: data.current.vis_km,
    clouds: data.current.cloud,
    sunrise: data.forecast?.forecastday?.[0]?.astro?.sunrise || 'N/A',
    sunset: data.forecast?.forecastday?.[0]?.astro?.sunset || 'N/A',
    timestamp: data.current.last_updated
  };
  
  let forecastData = null;
  
  if (forecast && data.forecast) {
    forecastData = data.forecast.forecastday.map(day => ({
      date: day.date,
      maxTemp: Math.round(day.day.maxtemp_c),
      minTemp: Math.round(day.day.mintemp_c),
      condition: day.day.condition.text,
      icon: `https:${day.day.condition.icon}`,
      humidity: day.day.avghumidity,
      sunrise: day.astro.sunrise,
      sunset: day.astro.sunset,
      moonPhase: day.astro.moon_phase
    }));
  }
  
  return {
    found: true,
    location: {
      name: data.location.name,
      country: data.location.country,
      state: data.location.region,
      coordinates: {
        lat: data.location.lat,
        lon: data.location.lon
      }
    },
    current: currentWeather,
    forecast: forecastData,
    units: units === 'metric' ? '°C' : '°F',
    source: 'WeatherAPI.com'
  };
}

function parseForecastData(forecastRaw, days, units) {
  const forecastByDay = {};
  
  forecastRaw.list.forEach(item => {
    const date = item.dt_txt.split(' ')[0];
    
    if (!forecastByDay[date]) {
      forecastByDay[date] = {
        date: date,
        temps: [],
        conditions: [],
        icons: [],
        humidities: []
      };
    }
    
    forecastByDay[date].temps.push(item.main.temp);
    forecastByDay[date].conditions.push(item.weather[0].main);
    forecastByDay[date].icons.push(item.weather[0].icon);
    forecastByDay[date].humidities.push(item.main.humidity);
  });
  
  // Convert to array and calculate daily averages
  return Object.values(forecastByDay)
    .slice(0, days)
    .map(day => ({
      date: day.date,
      maxTemp: Math.round(Math.max(...day.temps)),
      minTemp: Math.round(Math.min(...day.temps)),
      condition: getMostCommon(day.conditions),
      icon: getMostCommon(day.icons),
      humidity: Math.round(day.humidities.reduce((a, b) => a + b) / day.humidities.length),
      sunrise: 'N/A',
      sunset: 'N/A',
      moonPhase: 'N/A'
    }));
}

function getMostCommon(arr) {
  const counts = {};
  let maxCount = 0;
  let mostCommon = arr[0];
  
  arr.forEach(item => {
    counts[item] = (counts[item] || 0) + 1;
    if (counts[item] > maxCount) {
      maxCount = counts[item];
      mostCommon = item;
    }
  });
  
  return mostCommon;
}

function getMockWeatherData(location, units, forecast, days) {
  // Mock weather data for demonstration
  const tempUnit = units === 'metric' ? '°C' : '°F';
  const windUnit = units === 'metric' ? 'm/s' : 'mph';
  
  const conditions = ['Clear', 'Cloudy', 'Rain', 'Snow', 'Thunderstorm'];
  const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
  
  const currentWeather = {
    temperature: Math.floor(Math.random() * 30) + 10,
    feelsLike: Math.floor(Math.random() * 30) + 10,
    condition: randomCondition,
    description: `Mock ${randomCondition.toLowerCase()} weather`,
    icon: getWeatherIcon(randomCondition),
    humidity: Math.floor(Math.random() * 60) + 30,
    pressure: Math.floor(Math.random() * 50) + 970,
    windSpeed: (Math.random() * 10).toFixed(1),
    windDirection: Math.floor(Math.random() * 360),
    visibility: (Math.random() * 15 + 5).toFixed(1),
    clouds: Math.floor(Math.random() * 100),
    sunrise: '06:30 AM',
    sunset: '07:45 PM',
    timestamp: new Date().toISOString()
  };
  
  let forecastData = null;
  
  if (forecast) {
    forecastData = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const forecastCondition = conditions[Math.floor(Math.random() * conditions.length)];
      
      forecastData.push({
        date: date.toISOString().split('T')[0],
        maxTemp: currentWeather.temperature + Math.floor(Math.random() * 5),
        minTemp: currentWeather.temperature - Math.floor(Math.random() * 5),
        condition: forecastCondition,
        icon: getWeatherIcon(forecastCondition),
        humidity: Math.floor(Math.random() * 60) + 30,
        sunrise: '06:30 AM',
        sunset: '07:45 PM',
        moonPhase: ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 
                    'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent']
                  [Math.floor(Math.random() * 8)]
      });
    }
  }
  
  return {
    found: true,
    location: {
      name: location,
      country: 'Mock Country',
      state: 'Mock State',
      coordinates: { lat: 0, lon: 0 }
    },
    current: currentWeather,
    forecast: forecastData,
    units: tempUnit,
    windUnit: windUnit,
    source: 'Mock Weather Service'
  };
}

function getWeatherIcon(condition) {
  const icons = {
    'Clear': '☀️',
    'Cloudy': '☁️',
    'Rain': '🌧️',
    'Snow': '❄️',
    'Thunderstorm': '⛈️'
  };
  
  return icons[condition] || '🌤️';
}

function formatWeatherResponse(weatherData, forecast, detailed) {
  const location = weatherData.location;
  const current = weatherData.current;
  const tempUnit = weatherData.units;
  const conditionEmoji = getWeatherIcon(current.condition);
  
  let formatted = `${conditionEmoji} *Weather for ${location.name}*\n\n`;
  
  if (location.state && location.state !== location.name) {
    formatted += `📍 *Location:* ${location.name}, ${location.state}, ${location.country}\n`;
  } else {
    formatted += `📍 *Location:* ${location.name}, ${location.country}\n`;
  }
  
  formatted += `📅 *Updated:* ${new Date(current.timestamp).toLocaleTimeString()}\n\n`;
  
  formatted += `🌡️ *Temperature:* ${current.temperature}${tempUnit}\n`;
  formatted += `🤔 *Feels Like:* ${current.feelsLike}${tempUnit}\n`;
  formatted += `☁️ *Condition:* ${current.condition}\n`;
  formatted += `💧 *Humidity:* ${current.humidity}%\n`;
  formatted += `🌬️ *Wind:* ${current.windSpeed} m/s at ${current.windDirection}°\n`;
  
  if (detailed) {
    formatted += `📊 *Pressure:* ${current.pressure} hPa\n`;
    formatted += `👁️ *Visibility:* ${current.visibility} km\n`;
    formatted += `☁️ *Cloud Cover:* ${current.clouds}%\n`;
    formatted += `🌅 *Sunrise:* ${current.sunrise}\n`;
    formatted += `🌇 *Sunset:* ${current.sunset}\n`;
  }
  
  if (forecast && weatherData.forecast) {
    formatted += `\n📅 *${weatherData.forecast.length}-Day Forecast:*\n\n`;
    
    weatherData.forecast.forEach(day => {
      const date = new Date(day.date);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayEmoji = getWeatherIcon(day.condition);
      
      formatted += `${dayEmoji} *${dayName} (${day.date.split('-')[2]})*\n`;
      formatted += `   ${day.minTemp}${tempUnit} - ${day.maxTemp}${tempUnit}\n`;
      formatted += `   ${day.condition}\n`;
      
      if (detailed) {
        formatted += `   💧 ${day.humidity}% | 🌅 ${day.sunrise} | 🌇 ${day.sunset}\n`;
      }
      
      formatted += `\n`;
    });
  }
  
  formatted += `✅ *Source:* ${weatherData.source}\n`;
  
  if (!forecast) {
    formatted += `\n💡 *Get forecast:* !weather ${location.name} forecast:true days:3`;
  }
  
  if (!detailed) {
    formatted += `\n💡 *Detailed info:* !weather ${location.name} detailed:true`;
  }
  
  return formatted;
}

// Additional weather utilities
weatherFunction.airQuality = async function(location) {
  try {
    const apiKey = process.env.WEATHER_API_KEY;
    
    if (!apiKey) {
      return {
        success: false,
        error: 'Air quality data requires API key'
      };
    }
    
    // Get coordinates first
    const geocodeUrl = `http://api.openweathermap.org/geo/1.0/direct`;
    
    const geocodeResponse = await axios.get(geocodeUrl, {
      params: {
        q: location,
        limit: 1,
        appid: apiKey
      }
    });
    
    if (!geocodeResponse.data || geocodeResponse.data.length === 0) {
      return {
        success: false,
        error: 'Location not found'
      };
    }
    
    const { lat, lon } = geocodeResponse.data[0];
    
    // Get air quality
    const aqiUrl = `http://api.openweathermap.org/data/2.5/air_pollution`;
    
    const aqiResponse = await axios.get(aqiUrl, {
      params: {
        lat: lat,
        lon: lon,
        appid: apiKey
      }
    });
    
    const aqiData = aqiResponse.data.list[0];
    const aqi = aqiData.main.aqi;
    const components = aqiData.components;
    
    return {
      success: true,
      aqi: aqi,
      components: components,
      formatted: formatAirQualityResponse(location, aqi, components)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

function formatAirQualityResponse(location, aqi, components) {
  const aqiLevels = {
    1: { level: 'Good', emoji: '😊', description: 'Air quality is satisfactory' },
    2: { level: 'Fair', emoji: '😐', description: 'Air quality is acceptable' },
    3: { level: 'Moderate', emoji: '😷', description: 'Sensitive groups should limit outdoor exertion' },
    4: { level: 'Poor', emoji: '😨', description: 'Everyone may begin to experience health effects' },
    5: { level: 'Very Poor', emoji: '🤢', description: 'Health warning of emergency conditions' }
  };
  
  const level = aqiLevels[aqi] || aqiLevels[3];
  
  let formatted = `🌫️ *Air Quality for ${location}*\n\n`;
  formatted += `${level.emoji} *AQI:* ${aqi} - ${level.level}\n`;
  formatted += `📝 *Description:* ${level.description}\n\n`;
  
  formatted += `📊 *Pollutants:*\n`;
  formatted += `• CO: ${components.co.toFixed(2)} μg/m³\n`;
  formatted += `• NO: ${components.no.toFixed(2)} μg/m³\n`;
  formatted += `• NO₂: ${components.no2.toFixed(2)} μg/m³\n`;
  formatted += `• O₃: ${components.o3.toFixed(2)} μg/m³\n`;
  formatted += `• SO₂: ${components.so2.toFixed(2)} μg/m³\n`;
  formatted += `• PM2.5: ${components.pm2_5.toFixed(2)} μg/m³\n`;
  formatted += `• PM10: ${components.pm10.toFixed(2)} μg/m³\n`;
  formatted += `• NH₃: ${components.nh3.toFixed(2)} μg/m³\n\n`;
  
  formatted += `💡 *Recommendations:*\n`;
  
  if (aqi <= 2) {
    formatted += `• Outdoor activities are safe\n`;
    formatted += `• Windows can be opened\n`;
    formatted += `• Good for exercise\n`;
  } else if (aqi === 3) {
    formatted += `• Sensitive groups should stay indoors\n`;
    formatted += `• Limit prolonged outdoor exertion\n`;
    formatted += `• Keep windows closed\n`;
  } else {
    formatted += `• Stay indoors if possible\n`;
    formatted += `• Avoid outdoor activities\n`;
    formatted += `• Use air purifiers\n`;
    formatted += `• Wear masks outdoors\n`;
  }
  
  return formatted;
};

weatherFunction.alerts = async function(location) {
  try {
    const apiKey = process.env.WEATHERAPI_KEY;
    
    if (!apiKey) {
      return {
        success: false,
        error: 'Weather alerts require API key'
      };
    }
    
    const response = await axios.get('http://api.weatherapi.com/v1/alerts.json', {
      params: {
        key: apiKey,
        q: location
      }
    });
    
    const alerts = response.data.alerts?.alert || [];
    
    return {
      success: true,
      alerts: alerts,
      formatted: formatWeatherAlerts(location, alerts)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

function formatWeatherAlerts(location, alerts) {
  let formatted = `⚠️ *Weather Alerts for ${location}*\n\n`;
  
  if (alerts.length === 0) {
    formatted += `✅ No active weather alerts\n`;
    formatted += `Weather conditions are normal.\n`;
    return formatted;
  }
  
  formatted += `🚨 *${alerts.length} Active Alert${alerts.length !== 1 ? 's' : ''}:*\n\n`;
  
  alerts.slice(0, 3).forEach((alert, index) => {
    formatted += `${index + 1}. *${alert.headline}*\n`;
    formatted += `   Severity: ${alert.severity}\n`;
    formatted += `   Areas: ${alert.areas}\n`;
    formatted += `   Effective: ${new Date(alert.effective).toLocaleString()}\n`;
    formatted += `   Expires: ${new Date(alert.expires).toLocaleString()}\n\n`;
  });
  
  if (alerts.length > 3) {
    formatted += `📋 *${alerts.length - 3} more alerts*\n\n`;
  }
  
  formatted += `💡 *Stay safe and follow local authorities*`;
  
  return formatted;
};

module.exports = weatherFunction;
