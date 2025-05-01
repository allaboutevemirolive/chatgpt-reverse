// packages/service-worker/src/config/firebaseConfigs.ts
// NOTE: This file now ONLY exports the configuration object.
// Initialization happens in background.ts

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.projectId ||
    !firebaseConfig.appId
) {
    console.error(
        "Firebase configuration is missing essential values. Check your .env file and VITE_ prefix.",
    );
    // Consider throwing an error or having a fallback mechanism
}

export default firebaseConfig;
