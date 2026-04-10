import Constants from "expo-constants";

export const MAPBOX_ACCESS_TOKEN: string =
    Constants.expoConfig?.extra?.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';