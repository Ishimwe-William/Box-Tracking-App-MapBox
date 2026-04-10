import 'dotenv/config';
import { ExpoConfig, ConfigContext } from 'expo/config';
console.log(process.env.EXPO_PUBLIC_MAP_API_KEY);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Box Tracking App",
  slug: "snack-a2dfbe8d-69b5-41ad-85c3-be5105fe7799",
  version: "1.0.0",
  orientation: "default",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  ios: {
    supportsTablet: true
  },
  android: {
    permissions: ["LOCATION"],
    package: "com.bunsenplus.boxtrackingmap", 
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_MAP_API_KEY
      }
    }
  },
  web: {
    favicon: "./assets/favicon.png"
  },
  extra: {
    EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
    eas: {
      projectId: "6d62f713-015a-4e73-bfd7-f312e4c7604f"
    }
  },
  plugins: [
    [
      "@rnmapbox/maps",
      { RNMAPBOX_MAPS_DOWNLOAD_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_SDK_BINARY_TOKEN }
    ]
  ]

});