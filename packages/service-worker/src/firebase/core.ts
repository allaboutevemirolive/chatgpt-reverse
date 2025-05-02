// src/firebase/core.ts
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import firebaseConfig from "@/config/firebaseConfigs";
// import { FIRESTORE_DB_NAME } from "@/config/constants";

let firebaseAppInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;
let firebaseAuthInstance: Auth | null = null;

/**
 * Ensures Firebase services are initialized. Should be called early.
 * Throws an error if initialization fails.
 */
export function initializeFirebase(): void {
    if (firebaseAppInstance) {
        return; // Already initialized
    }

    console.log("Firebase Core: Attempting initialization...");
    try {
        if (
            !firebaseConfig.apiKey ||
            !firebaseConfig.projectId ||
            !firebaseConfig.appId
        ) {
            throw new Error(
                "Firebase configuration is missing essential values.",
            );
        }

        firebaseAppInstance = initializeApp(firebaseConfig);
        console.log("Firebase Core: App initialized.");

        // Initialize Firestore (allow specifying DB name)
        firestoreInstance = getFirestore(
            firebaseAppInstance,
            // FIRESTORE_DB_NAME,
        );

        console.log(`Firebase Core: Firestore initialized (DB: (default)).`);

        // console.log(
        //     `Firebase Core: Firestore initialized (DB: ${FIRESTORE_DB_NAME}).`,
        // );

        // Initialize Auth
        firebaseAuthInstance = getAuth(firebaseAppInstance);
        console.log("Firebase Core: Auth initialized.");
    } catch (error) {
        console.error("Firebase Core: Initialization failed:", error);
        // Reset instances on failure
        firebaseAppInstance = null;
        firestoreInstance = null;
        firebaseAuthInstance = null;
        throw error; // Re-throw for calling code to handle
    }
}

/**
 * Gets the initialized Firebase App instance.
 * Throws an error if Firebase is not initialized.
 */
export function getFirebaseApp(): FirebaseApp {
    if (!firebaseAppInstance) {
        throw new Error("Firebase App accessed before initialization.");
    }
    return firebaseAppInstance;
}

/**
 * Gets the initialized Firestore instance.
 * Throws an error if Firebase is not initialized.
 */
export function getDb(): Firestore {
    if (!firestoreInstance) {
        throw new Error("Firestore accessed before initialization.");
    }
    return firestoreInstance;
}

/**
 * Gets the initialized Firebase Auth instance.
 * Throws an error if Firebase is not initialized.
 */
export function getFirebaseAuth(): Auth {
    if (!firebaseAuthInstance) {
        throw new Error("Firebase Auth accessed before initialization.");
    }
    return firebaseAuthInstance;
}
