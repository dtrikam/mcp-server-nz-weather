#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Weather API constants
const NWS_API_BASE = "https://api.weather.gov";
const OPEN_METEO_API_BASE = "https://api.open-meteo.com/v1/forecast";
const USER_AGENT = "weather-app/1.0";

// Create server instance
const server = new McpServer({
  name: "weather-service",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {
      "get-alerts": { description: "Get weather alerts for a US state" },
      "get-forecast": {
        description:
          "Get weather forecast for a location (supports worldwide locations including New Zealand)",
      },
      "get-nz-forecast": {
        description: "Get weather forecast for New Zealand cities",
      },
    },
  },
});

// Helper function for making NWS API requests (US weather)
async function makeNWSRequest<T>(url: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/geo+json",
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making NWS request:", error);
    return null;
  }
}

// Helper function for making Open-Meteo API requests (international weather)
async function makeOpenMeteoRequest(
  latitude: number,
  longitude: number
): Promise<any | null> {
  try {
    const url = `${OPEN_METEO_API_BASE}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=auto`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error making Open-Meteo request:", error);
    return null;
  }
}

// Check if coordinates are likely in the US (rough estimation)
function isLikelyUS(latitude: number, longitude: number): boolean {
  // Simplified check for continental US, Hawaii, Alaska, and territories
  return (
    // Continental US
    (latitude >= 24.5 &&
      latitude <= 49.5 &&
      longitude >= -125.0 &&
      longitude <= -66.0) ||
    // Hawaii
    (latitude >= 18.0 &&
      latitude <= 23.0 &&
      longitude >= -161.0 &&
      longitude <= -154.0) ||
    // Alaska
    (latitude >= 51.0 &&
      latitude <= 72.0 &&
      longitude >= -180.0 &&
      longitude <= -129.0) ||
    // Puerto Rico & US Virgin Islands
    (latitude >= 17.5 &&
      latitude <= 19.0 &&
      longitude >= -68.0 &&
      longitude <= -64.0)
  );
}

// Format alert data
function formatAlert(feature: any): string {
  const props = feature.properties;
  return [
    `Event: ${props.event || "Unknown"}`,
    `Area: ${props.areaDesc || "Unknown"}`,
    `Severity: ${props.severity || "Unknown"}`,
    `Description: ${props.description || "No description available"}`,
    `Instruction: ${props.instruction || "No specific instructions provided"}`,
  ].join("\n");
}

// Map Open-Meteo weather codes to descriptions
function getWeatherDescription(code: number): string {
  const weatherCodes: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return weatherCodes[code] || "Unknown";
}

// Format Open-Meteo forecast data
function formatOpenMeteoForecast(data: any): string {
  if (!data || !data.daily) {
    return "No forecast data available";
  }

  const { daily, current } = data;
  const formattedCurrentWeather = [
    "Current conditions:",
    `Temperature: ${current.temperature_2m}°C`,
    `Conditions: ${getWeatherDescription(current.weather_code)}`,
    `Wind: ${current.wind_speed_10m} km/h${
      current.wind_direction_10m
        ? ` from ${degreesToDirection(current.wind_direction_10m)}`
        : ""
    }`,
  ].join("\n");

  const formattedDailyForecast = Array.from(
    { length: Math.min(daily.time.length, 5) },
    (_, i) => {
      return [
        `${formatDate(daily.time[i])}:`,
        `Temperature: ${daily.temperature_2m_min[i]}°C to ${daily.temperature_2m_max[i]}°C`,
        `Conditions: ${getWeatherDescription(daily.weather_code[i])}`,
      ].join("\n");
    }
  ).join("\n\n---\n\n");

  return `${formattedCurrentWeather}\n\n---\n\n${formattedDailyForecast}`;
}

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

// Convert wind direction from degrees to cardinal direction
function degreesToDirection(degrees: number): string {
  const directions = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const index = Math.round((degrees % 360) / 22.5) % 16;
  return directions[index];
}

// Register weather tools
server.tool(
  "get-alerts",
  "Get weather alerts for a US state",
  {
    state: z.string().length(2).describe("Two-letter state code (e.g. CA, NY)"),
  },
  async ({ state }) => {
    const stateCode = state.toUpperCase();
    const alertsUrl = `${NWS_API_BASE}/alerts/active/area/${stateCode}`;
    const alertsData = await makeNWSRequest<any>(alertsUrl);

    if (!alertsData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve alerts data",
          },
        ],
      };
    }

    const features = alertsData.features || [];
    if (features.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No active alerts for ${stateCode}`,
          },
        ],
      };
    }

    const formattedAlerts = features.map(formatAlert).join("\n\n---\n\n");
    const alertsText = `Active alerts for ${stateCode}:\n\n${formattedAlerts}`;

    return {
      content: [
        {
          type: "text",
          text: alertsText,
        },
      ],
    };
  }
);

server.tool(
  "get-forecast",
  "Get weather forecast for a location (supports worldwide locations including New Zealand)",
  {
    latitude: z.number().min(-90).max(90).describe("Latitude of the location"),
    longitude: z
      .number()
      .min(-180)
      .max(180)
      .describe("Longitude of the location"),
  },
  async ({ latitude, longitude }) => {
    // Check if coordinates are likely in the US
    if (isLikelyUS(latitude, longitude)) {
      // Use NWS API for US locations
      const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(
        4
      )},${longitude.toFixed(4)}`;
      const pointsData = await makeNWSRequest<any>(pointsUrl);

      if (!pointsData) {
        // If NWS API fails, fall back to Open-Meteo
        const meteoData = await makeOpenMeteoRequest(latitude, longitude);
        if (meteoData) {
          const formattedForecast = formatOpenMeteoForecast(meteoData);
          return {
            content: [
              {
                type: "text",
                text: `Forecast for ${latitude}, ${longitude} (international data):\n\n${formattedForecast}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve weather data for coordinates: ${latitude}, ${longitude}.`,
            },
          ],
        };
      }

      const forecastUrl = pointsData.properties?.forecast;
      if (!forecastUrl) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to get forecast URL from grid point data",
            },
          ],
        };
      }

      // Get forecast data
      const forecastData = await makeNWSRequest<any>(forecastUrl);
      if (!forecastData) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to retrieve forecast data",
            },
          ],
        };
      }

      const periods = forecastData.properties?.periods || [];
      if (periods.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No forecast periods available",
            },
          ],
        };
      }

      // Format forecast periods
      const formattedForecast = periods
        .slice(0, 5)
        .map((period: any) =>
          [
            `${period.name || "Unknown"}:`,
            `Temperature: ${period.temperature || "Unknown"}°${
              period.temperatureUnit || "F"
            }`,
            `Wind: ${period.windSpeed || "Unknown"} ${
              period.windDirection || ""
            }`,
            `Forecast: ${period.detailedForecast || "No forecast available"}`,
          ].join("\n")
        )
        .join("\n\n---\n\n");

      const forecastText = `Forecast for ${latitude}, ${longitude} (US data):\n\n${formattedForecast}`;

      return {
        content: [
          {
            type: "text",
            text: forecastText,
          },
        ],
      };
    } else {
      // For international locations including New Zealand, use Open-Meteo API
      const meteoData = await makeOpenMeteoRequest(latitude, longitude);
      if (!meteoData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve international weather data for coordinates: ${latitude}, ${longitude}.`,
            },
          ],
        };
      }

      const formattedForecast = formatOpenMeteoForecast(meteoData);
      return {
        content: [
          {
            type: "text",
            text: `Forecast for ${latitude}, ${longitude} (international data):\n\n${formattedForecast}`,
          },
        ],
      };
    }
  }
);

// New Zealand city coordinates
const nzCities: Record<string, { latitude: number; longitude: number }> = {
  auckland: { latitude: -36.8509, longitude: 174.7645 },
  wellington: { latitude: -41.2865, longitude: 174.7762 },
  christchurch: { latitude: -43.532, longitude: 172.6362 },
  hamilton: { latitude: -37.787, longitude: 175.2793 },
  tauranga: { latitude: -37.6878, longitude: 176.1651 },
  dunedin: { latitude: -45.8788, longitude: 170.5028 },
  napier: { latitude: -39.4928, longitude: 176.912 },
  nelson: { latitude: -41.2708, longitude: 173.284 },
  queenstown: { latitude: -45.0312, longitude: 168.6626 },
  rotorua: { latitude: -38.1368, longitude: 176.2497 },
  invercargill: { latitude: -46.4132, longitude: 168.3538 },
  "palmerston north": { latitude: -40.3564, longitude: 175.6102 },
  whangarei: { latitude: -35.7275, longitude: 174.3166 },
  "new plymouth": { latitude: -39.0556, longitude: 174.0752 },
};

// Add specific tool for New Zealand weather
server.tool(
  "get-nz-forecast",
  "Get weather forecast for New Zealand cities",
  {
    city: z
      .string()
      .describe(
        "Name of New Zealand city (e.g., Auckland, Wellington, Christchurch)"
      ),
  },
  async ({ city }) => {
    const cityLower = city.toLowerCase();
    const cityData = nzCities[cityLower];

    if (!cityData) {
      // Try to find a partial match
      const possibleCities = Object.keys(nzCities).filter((c) =>
        c.includes(cityLower)
      );

      if (possibleCities.length > 0) {
        return {
          content: [
            {
              type: "text",
              text: `City "${city}" not found. Did you mean one of these: ${possibleCities.join(
                ", "
              )}?`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `City "${city}" not found in New Zealand cities database. Available cities: ${Object.keys(
              nzCities
            ).join(", ")}`,
          },
        ],
      };
    }

    const { latitude, longitude } = cityData;
    const meteoData = await makeOpenMeteoRequest(latitude, longitude);

    if (!meteoData) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve weather data for ${city}, New Zealand.`,
          },
        ],
      };
    }

    const formattedForecast = formatOpenMeteoForecast(meteoData);

    return {
      content: [
        {
          type: "text",
          text: `Weather forecast for ${
            city.charAt(0).toUpperCase() + city.slice(1)
          }, New Zealand:\n\n${formattedForecast}`,
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Weather MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
