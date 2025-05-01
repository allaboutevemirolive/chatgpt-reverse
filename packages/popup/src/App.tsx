// packages/popup/src/App.tsx
import { useState, useEffect } from "react";
import logo from "./assets/logo.svg";
import { sendMessageToSW } from "./utils/swMessenger";
import styles from "./App.module.css";

// --- Type Definitions ---
interface UserData {
    uid: string;
    email: string | null;
}
interface AuthState {
    isLoggedIn: boolean;
    uid: string | null;
    email: string | null;
}

function App() {
    // --- State Variables ---
    const [authState, setAuthState] = useState<AuthState>({
        isLoggedIn: false,
        uid: null,
        email: null,
    });
    const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true); // Keep loading true initially
    const [authError, setAuthError] = useState<string | null>(null);

    // --- Fetch Auth State ---
    useEffect(() => {
        console.log(
            "Popup: useEffect started. Initial isLoadingAuth:",
            isLoadingAuth,
        );
        let isMounted = true;

        const fetchAuthState = async () => {
            // Ensure loading state is true at the start if not already
            if (isMounted && !isLoadingAuth) {
                setIsLoadingAuth(true);
                setAuthError(null);
            } else if (isMounted) {
                setAuthError(null); // Clear error even if already loading
            }

            try {
                console.log("Popup: Sending GET_AUTH_STATE message...");
                const userData = await sendMessageToSW<UserData | null>({
                    type: "GET_AUTH_STATE",
                });
                console.log("Popup: Received auth state response:", userData);

                if (!isMounted) return;

                setAuthState(
                    userData
                        ? { isLoggedIn: true, ...userData }
                        : { isLoggedIn: false, uid: null, email: null },
                );
            } catch (error: any) {
                if (!isMounted) return;
                console.error("Popup: Error fetching auth state:", error);
                setAuthError(
                    error.message || "Failed to fetch authentication status.",
                );
                setAuthState({ isLoggedIn: false, uid: null, email: null });
            } finally {
                if (isMounted) {
                    console.log(
                        "Popup: fetchAuthState finally block. Setting isLoadingAuth to false.",
                    );
                    setIsLoadingAuth(false);
                }
            }
        };

        fetchAuthState();

        const messageListener = (message: any) => {
            if (message.type === "AUTH_STATE_UPDATED" && isMounted) {
                console.log(
                    "Popup: Received AUTH_STATE_UPDATED",
                    message.payload,
                );
                if (typeof message.payload?.isLoggedIn === "boolean") {
                    setAuthState(message.payload);
                    setIsLoadingAuth(false);
                    setAuthError(null);
                }
            }
        };
        chrome.runtime.onMessage.addListener(messageListener);

        return () => {
            console.log("Popup: Unmounting. Cleaning up listener.");
            isMounted = false;
            chrome.runtime.onMessage.removeListener(messageListener);
        };
    }, []); // Empty dependency array

    // --- Event Handlers ---
    const openAuthPage = () => {
        try {
            const authUrl = chrome.runtime.getURL("popup/auth.html");
            chrome.tabs.create({ url: authUrl });
            window.close();
        } catch (error) {
            setAuthError("Could not open the authentication page.");
        }
    };

    const handleLogout = async () => {
        setIsLoadingAuth(true); // Show loading during logout
        setAuthError(null);
        try {
            await sendMessageToSW({ type: "LOGOUT_USER" });
            setAuthState({ isLoggedIn: false, uid: null, email: null });
        } catch (error: any) {
            setAuthError(error.message || "Logout failed.");
        } finally {
            // Set loading false *after* logout attempt, regardless of auth state
            setIsLoadingAuth(false);
        }
    };

    // --- Render Helper ---
    const renderAccountSection = () => {
        // * Crucially, always show loading first *
        if (isLoadingAuth) {
            console.log("Popup: Rendering Loading State");
            // You could add a small spinner here if desired
            return (
                <p className={styles.description}>Loading account status...</p>
            );
        }

        // If there was an error after loading, show it
        if (authError) {
            console.log("Popup: Rendering Error State:", authError);
            // Offer a way to retry or login again
            return (
                <>
                    <p className={styles.errorText}>{authError}</p>
                    <button onClick={openAuthPage} className={styles.button}>
                        Login / Register
                    </button>
                </>
            );
        }

        // If loading is finished and no error, *then* check login state
        if (authState.isLoggedIn) {
            console.log("Popup: Rendering Logged In State");
            return (
                <>
                    <p className={styles.loggedInText}>
                        Logged in as:
                        <br />{" "}
                        <strong className={styles.loggedInEmail}>
                            {authState.email || "N/A"}
                        </strong>
                    </p>
                    <button
                        onClick={handleLogout}
                        className={styles.logoutButton}
                    >
                        Logout
                    </button>
                </>
            );
        } else {
            // Loading finished, no error, not logged in
            console.log("Popup: Rendering Logged Out State");
            return (
                <>
                    <p className={styles.description}>
                        Login or Register for features.
                    </p>
                    <button onClick={openAuthPage} className={styles.button}>
                        Login / Register
                    </button>
                </>
            );
        }
    };

    // --- Main Return ---
    return (
        // Apply the container class from the CSS module
        <div className={styles.container}>
            {/* Header Section */}
            <img src={logo} alt="Extension Logo" className={styles.logo} />
            <h1 className={styles.title}>ChatGPT Reverse</h1>
            <p className={styles.description}>
                Your enhancement tools are ready!
            </p>

            {/* Instruction Section */}
            <div className={styles.instructionBox}>
                <p className={styles.instructionText}>How to Access Tools:</p>
                <p className={styles.instructionSubText}>
                    On <code className={styles.kbdCode}>chatgpt.com</code>,
                    press:
                </p>
                <div className={styles.shortcutContainer}>
                    <kbd className={styles.kbd}>CTRL</kbd>
                    <span className={styles.shortcutPlus}>+</span>
                    <kbd className={styles.kbd}>G</kbd>
                </div>
            </div>

            {/* Account Section (uses render helper) */}
            <div className={styles.accountSection}>
                {renderAccountSection()}
            </div>
        </div>
    );
}

export default App;
