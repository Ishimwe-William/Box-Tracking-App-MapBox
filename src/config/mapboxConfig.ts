import Constants from 'expo-constants';

const token: string =
    Constants.expoConfig?.extra?.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

if (!token) {
    console.warn(
        '[Mapbox] Access token is missing. ' +
        'Make sure EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is set in your .env file ' +
        'and the app was rebuilt after changing app.config.ts.'
    );
}

export const MAPBOX_ACCESS_TOKEN = token;