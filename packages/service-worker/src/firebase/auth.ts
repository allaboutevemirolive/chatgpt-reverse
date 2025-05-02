// src/firebase/auth.ts
import {
    onAuthStateChanged,
    User,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    UserCredential,
} from "firebase/auth";
import { getFirebaseAuth } from "./core";

// --- State Variables ---
let currentUserState: User | null = null;
let authReadyResolver: ((value: User | null) => void) | null = null;
let authReadyPromise: Promise<User | null> | null = null;
let isAuthListenerAttached = false;

// --- Internal Functions ---

/** Initializes or resets the promise that resolves when the initial auth state is known. */
function initializeAuthReadyPromise() {
    authReadyPromise = new Promise<User | null>((resolve) => {
        authReadyResolver = resolve;
        console.log("Firebase Auth: authReadyPromise created/recreated.");
    });
}

/** Broadcasts auth state updates to other parts of the extension. */
function broadcastAuthState(user: User | null, error?: Error) {
    console.log("Firebase Auth: Broadcasting AUTH_STATE_UPDATED");
    const statePayload = {
        isLoggedIn: !!user,
        uid: user?.uid ?? null,
        email: user?.email ?? null,
        error: error?.message,
    };
    chrome.runtime
        .sendMessage({
            type: "AUTH_STATE_UPDATED",
            payload: statePayload,
        })
        .catch((e) =>
            console.log(
                "Firebase Auth: Error broadcasting auth state (no listeners?):",
                e.message,
            ),
        );
}

// --- Public API ---

/**
 * Attaches the Firebase Auth state listener. Should be called once.
 * Relies on Firebase core being initialized first.
 */
export function setupAuthListener(): void {
    if (isAuthListenerAttached) {
        console.warn("Firebase Auth: Listener already attached.");
        return;
    }
    if (!authReadyPromise) {
        initializeAuthReadyPromise(); // Ensure promise exists
    }

    try {
        const auth = getFirebaseAuth(); // Get initialized Auth
        console.log("Firebase Auth: Setting up onAuthStateChanged listener.");

        onAuthStateChanged(
            auth,
            (user) => {
                console.log(
                    `Firebase Auth: onAuthStateChanged triggered. User: ${user?.uid ?? "null"}`,
                );
                const changed = currentUserState?.uid !== user?.uid;
                currentUserState = user;

                // Resolve the promise *only the first time* it fires
                if (authReadyResolver) {
                    console.log("Firebase Auth: Resolving authReadyPromise.");
                    authReadyResolver(currentUserState);
                    authReadyResolver = null; // Prevent resolving again
                }

                // Broadcast state if it actually changed
                if (changed) {
                    broadcastAuthState(user);
                }
            },
            (error) => {
                console.error(
                    "Firebase Auth: Auth state listener error:",
                    error,
                );
                const previousUser = currentUserState;
                currentUserState = null;

                if (authReadyResolver) {
                    console.log(
                        "Firebase Auth: Resolving authReadyPromise with null due to listener error.",
                    );
                    authReadyResolver(null);
                    authReadyResolver = null;
                }
                // Broadcast error state if it changed
                if (previousUser !== null) {
                    broadcastAuthState(null, error);
                }
            },
        );
        isAuthListenerAttached = true;
        console.log("Firebase Auth: Listener attached.");
    } catch (error) {
        console.error("Firebase Auth: Failed to setup listener:", error);
        isAuthListenerAttached = false;
        currentUserState = null;
        // Ensure promise resolves with null if setup fails
        if (authReadyResolver) {
            authReadyResolver(null);
            authReadyResolver = null;
        } else if (!authReadyPromise) {
            initializeAuthReadyPromise();
            authReadyResolver!(null);
            authReadyResolver = null;
        }
        // Optionally re-throw or handle more gracefully
    }
}

/** Resets the auth ready promise, useful on install/startup. */
export function resetAuthReadyPromise(): void {
    initializeAuthReadyPromise();
}

/** Returns a promise that resolves when the initial authentication state is known. */
export function awaitAuthReady(): Promise<User | null> {
    if (!authReadyPromise) {
        console.warn(
            "Firebase Auth: awaitAuthReady called before promise was initialized. Initializing now.",
        );
        initializeAuthReadyPromise();
    }
    // If the listener hasn't been attached yet, setting it up is critical
    if (!isAuthListenerAttached) {
        console.warn(
            "Firebase Auth: awaitAuthReady called before listener setup. Setting up listener now.",
        );
        setupAuthListener(); // Attempt setup if not already done
    }
    return authReadyPromise!;
}

/** Gets the currently cached user object (may be null). */
export function getCurrentUser(): User | null {
    return currentUserState;
}

/** Gets the current authentication state synchronously. */
export function getAuthState(): {
    isLoggedIn: boolean;
    uid: string | null;
    email: string | null;
} {
    const user = getCurrentUser();
    return {
        isLoggedIn: !!user,
        uid: user?.uid ?? null,
        email: user?.email ?? null,
    };
}

/** Registers a new user with email and password. */
export async function registerUser(
    email: string,
    password: string,
): Promise<{ uid: string; email: string | null }> {
    if (!email || !password)
        throw new Error("Email and password required for registration.");
    const auth = getFirebaseAuth();
    const userCredential: UserCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
    );
    return {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
    };
}

/** Logs in a user with email and password. */
export async function loginUser(
    email: string,
    password: string,
): Promise<{ uid: string; email: string | null }> {
    if (!email || !password)
        throw new Error("Email and password required for login.");
    const auth = getFirebaseAuth();
    const userCredential: UserCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
    );
    return {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
    };
}

/** Logs out the current user. */
export async function logoutUser(): Promise<{ message: string }> {
    const auth = getFirebaseAuth();
    await signOut(auth);
    return { message: "Logout successful." };
}
