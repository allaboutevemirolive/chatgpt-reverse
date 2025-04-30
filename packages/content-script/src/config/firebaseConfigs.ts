import { initializeApp, FirebaseApp } from "firebase/app";

// NOTE: Any registration for new user should be made on website. The firebase
// configuration in our extension only focus on `login` and check user status.

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    console.error("Firebase configuration is missing essential values. Check your .env file and VITE_ prefix.");
}

let app: FirebaseApp | null = null;

export const initFirebase = (): FirebaseApp => {
    if (!app) {
        try {
            if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId) {
                app = initializeApp(firebaseConfig);
                console.log("Firebase initialized successfully in content script context.");
            } else {
                console.error("Skipping Firebase initialization due to missing config.");
                throw new Error("Cannot initialize Firebase: Missing configuration.");
            }
        } catch (error) {
            console.error("Error initializing Firebase:", error);
            throw error;
        }
    }
    if (!app) {
        throw new Error("Firebase app is unexpectedly null after initialization attempt.");
    }
    return app;
};

export const getFirebaseApp = (): FirebaseApp | null => {
    // Call initFirebase() here to auto-initialization on first get
    if (!app) {
        try {
            initFirebase();
        } catch (e) { /* handle error */ }
    }
    return app;
}
