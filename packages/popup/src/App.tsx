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
    const [authState, setAuthState] = useState<AuthState>({ isLoggedIn: false, uid: null, email: null });
    const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
    const [authError, setAuthError] = useState<string | null>(null);

    // --- Fetch Auth State ---
    useEffect(() => {
        const fetchAuthState = async () => {
            setIsLoadingAuth(true);
            setAuthError(null);
            try {
                const userData = await sendMessageToSW<UserData | null>({ type: "GET_AUTH_STATE" });
                setAuthState(userData ? { isLoggedIn: true, ...userData } : { isLoggedIn: false, uid: null, email: null });
            } catch (error: any) {
                setAuthError(error.message || "Failed to fetch authentication status.");
                setAuthState({ isLoggedIn: false, uid: null, email: null });
            } finally {
                setIsLoadingAuth(false);
            }
        };
        fetchAuthState();

        const messageListener = (message: any) => {
            if (message.type === 'AUTH_STATE_UPDATED') {
                setAuthState(message.payload);
            }
        };
        chrome.runtime.onMessage.addListener(messageListener);
        return () => chrome.runtime.onMessage.removeListener(messageListener);
    }, []);

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
        setIsLoadingAuth(true);
        setAuthError(null);
        try {
            await sendMessageToSW({ type: "LOGOUT_USER" });
            setAuthState({ isLoggedIn: false, uid: null, email: null });
        } catch (error: any) {
            setAuthError(error.message || "Logout failed.");
        } finally {
            setIsLoadingAuth(false);
        }
    };

    return (
        // Apply the container class from the CSS module
        // You might keep a base AppContainer class from App.css if it has global resets/structure
        <div className={`${styles.container} AppContainer`}>

            {/* Header Section */}
            <img src={logo} alt="Extension Logo" className={styles.logo} />
            <h1 className={styles.title}>ChatGPT Reverse</h1>
            <p className={styles.description}>Your enhancement tools are ready!</p>

            {/* Instruction Section */}
            <div className={styles.instructionBox}>
                <p className={styles.instructionText}>How to Access Tools:</p>
                <p className={styles.instructionSubText}>
                    On{" "}
                    <code className={styles.kbdCode}>chatgpt.com</code>, press:
                </p>
                <div className={styles.shortcutContainer}>
                    <kbd className={styles.kbd}>CTRL</kbd>
                    <span className={styles.shortcutPlus}>+</span>
                    <kbd className={styles.kbd}>G</kbd>
                </div>
            </div>

            {/* Account Section (Conditional Rendering) */}
            <div className={styles.accountSection}>
                {isLoadingAuth ? (
                    <p className={styles.description}>Loading account status...</p>
                ) : authState.isLoggedIn ? (
                    /* --- Logged In View --- */
                    <>
                        <p className={styles.loggedInText}>
                            Logged in as:<br /> <strong className={styles.loggedInEmail}>{authState.email}</strong>
                        </p>
                        <button
                            onClick={handleLogout}
                            className={styles.logoutButton} // Use logout specific class
                            disabled={isLoadingAuth}
                        >
                            Logout
                        </button>
                    </>
                ) : (
                    /* --- Logged Out View --- */
                    <>
                        <p className={styles.description}>Login or Register for features.</p>
                        <button
                            onClick={openAuthPage}
                            className={styles.button} // Use base button class
                            disabled={isLoadingAuth}
                        >
                            Login / Register
                        </button>
                    </>
                )}
                {/* Display any errors */}
                {authError && <p className={styles.errorText}>{authError}</p>}
            </div>
        </div>
    );
}

export default App;
