// packages/popup/src/index/App.tsx
import { useState, useEffect } from "react";
import logo from "../assets/logo.svg";
import { sendMessageToSW } from "../utils/swMessenger";
import styles from "./App.module.css";
import Button from "../components/Button/Button"; // Import the Button component

// --- Type Definitions (Locally defined or import if shared) ---
interface UserData {
    uid: string;
    email: string | null;
}
interface AuthState {
    isLoggedIn: boolean;
    uid: string | null;
    email: string | null;
}
// Define the subscription type needed in this component
interface UserSubscription {
    planId: "free" | "monthly" | "lifetime" | null;
    status?: string | null;
}
// --- Component ---

function App() {
    // --- State ---
    const [authState, setAuthState] = useState<AuthState>({
        isLoggedIn: false,
        uid: null,
        email: null,
    });
    // Add state for subscription and its loading status
    const [subscription, setSubscription] = useState<UserSubscription | null>(
        null,
    );
    const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
    const [isLoadingSub, setIsLoadingSub] = useState<boolean>(false); // Separate loading for subscription
    const [error, setError] = useState<string | null>(null); // Consolidated error state

    // --- Effects ---
    useEffect(() => {
        console.log("Popup: useEffect started.");
        let isMounted = true;

        // Function to fetch subscription status
        const fetchSubscriptionStatus = async () => {
            if (!isMounted || !authState.isLoggedIn || !authState.uid) return; // Only run if mounted and logged in

            console.log("Popup: Fetching subscription status...");
            setIsLoadingSub(true);
            setError(null); // Clear previous errors before fetching sub

            try {
                const subData = await sendMessageToSW<UserSubscription | null>({
                    type: "GET_SUBSCRIPTION_STATUS",
                });
                console.log("Popup: Received subscription status:", subData);
                if (!isMounted) return;

                // Ensure planId is valid or defaults to 'free'
                const validPlanId =
                    subData?.planId === "monthly" ||
                        subData?.planId === "lifetime"
                        ? subData.planId
                        : "free";
                setSubscription(
                    subData
                        ? { ...subData, planId: validPlanId }
                        : { planId: "free", status: null },
                );
            } catch (subError: any) {
                if (!isMounted) return;
                console.error(
                    "Popup: Error fetching subscription status:",
                    subError,
                );
                setError(
                    subError.message || "Failed to load subscription details.",
                );
                setSubscription(null); // Reset subscription on error
            } finally {
                if (isMounted) {
                    setIsLoadingSub(false);
                }
            }
        };

        // Function to fetch initial auth state
        const fetchAuthState = async () => {
            if (!isMounted) return;
            setIsLoadingAuth(true);
            setError(null);

            try {
                console.log("Popup: Sending GET_AUTH_STATE message...");
                const userData = await sendMessageToSW<UserData | null>({
                    type: "GET_AUTH_STATE",
                });
                console.log("Popup: Received auth state response:", userData);
                if (!isMounted) return;

                const currentAuthState = userData
                    ? { isLoggedIn: true, ...userData }
                    : { isLoggedIn: false, uid: null, email: null };
                setAuthState(currentAuthState);

                // If logged in, trigger subscription fetch
                if (currentAuthState.isLoggedIn) {
                    fetchSubscriptionStatus(); // Don't await here, let it run in background
                }
            } catch (authError: any) {
                if (!isMounted) return;
                console.error("Popup: Error fetching auth state:", authError);
                setError(
                    authError.message || "Failed to fetch authentication status.",
                );
                setAuthState({ isLoggedIn: false, uid: null, email: null });
                setSubscription(null); // Ensure subscription is cleared on auth error
            } finally {
                if (isMounted) {
                    setIsLoadingAuth(false);
                }
            }
        };

        fetchAuthState();

        // --- SW Message Listener ---
        const messageListener = (message: any) => {
            if (!isMounted) return;
            console.log("Popup: Received message from SW:", message?.type);

            if (message.type === "AUTH_STATE_UPDATED") {
                const newAuthState: AuthState = message.payload;
                console.log("Popup: Processing AUTH_STATE_UPDATED", newAuthState);
                setAuthState(newAuthState); // Update auth state
                setError(null); // Clear errors on auth update

                if (newAuthState.isLoggedIn) {
                    // If user just logged in (or state re-confirmed), fetch/re-fetch subscription
                    fetchSubscriptionStatus();
                } else {
                    // If user logged out, clear subscription state
                    setSubscription(null);
                    setIsLoadingSub(false); // Ensure sub loading stops if user logs out
                }
                // Auth loading is finished once we get an update
                setIsLoadingAuth(false);

            } else if (message.type === "SUBSCRIPTION_UPDATED") {
                const subPayload: UserSubscription | null = message.payload;
                console.log("Popup: Processing SUBSCRIPTION_UPDATED", subPayload);
                // Ensure planId is valid or defaults to 'free'
                const validPlanId =
                    subPayload?.planId === "monthly" ||
                        subPayload?.planId === "lifetime"
                        ? subPayload.planId
                        : "free";
                setSubscription(
                    subPayload
                        ? { ...subPayload, planId: validPlanId }
                        : { planId: "free", status: null }
                );
                setIsLoadingSub(false); // Subscription update means loading is done
                setError(null); // Clear potential previous errors
            }
        };
        chrome.runtime.onMessage.addListener(messageListener);

        // --- Cleanup ---
        return () => {
            console.log("Popup: Unmounting. Cleaning up listener.");
            isMounted = false;
            chrome.runtime.onMessage.removeListener(messageListener);
        };
    }, []); // Empty dependency array means this runs once on mount

    // --- Event Handlers ---
    const openAuthPage = () => {
        try {
            const authUrl = chrome.runtime.getURL("popup/auth.html");
            chrome.tabs.create({ url: authUrl });
            window.close(); // Close the popup after opening the auth page
        } catch (e) {
            setError("Could not open the account page.");
            console.error("Error opening auth page:", e);
        }
    };

    const handleLogout = async () => {
        // Indicate loading during the logout process
        setIsLoadingAuth(true);
        setIsLoadingSub(false); // Stop sub loading if logout starts
        setSubscription(null); // Clear subscription immediately
        setError(null);
        try {
            await sendMessageToSW({ type: "LOGOUT_USER" });
            // The listener will handle the final state update
        } catch (error: any) {
            setError(error.message || "Logout failed.");
            // If logout fails, we might still be technically logged in,
            // so revert loading state but keep potentially logged-in authState
            setIsLoadingAuth(false);
        }
        // Don't set isLoadingAuth false here, let the listener do it
    };

    // --- Render Helper ---
    const renderAccountSection = () => {
        // Combined loading state check
        const isLoading = isLoadingAuth || (authState.isLoggedIn && isLoadingSub);

        if (isLoading) {
            console.log("Popup: Rendering Loading State");
            return (
                <p className={styles.description}>Loading account status...</p>
            );
        }

        if (error) {
            console.log("Popup: Rendering Error State:", error);
            return (
                <>
                    <p className={styles.errorText}>{error}</p>
                    {/* Offer login/retry even on error */}
                    <Button
                        onClick={openAuthPage}
                        variant="secondary" // Use secondary for retry/login on error
                    >
                        {authState.isLoggedIn ? "Retry" : "Login / Register"}
                    </Button>
                </>
            );
        }

        // ---- Logged In State ----
        if (authState.isLoggedIn) {
            console.log("Popup: Rendering Logged In State. Sub:", subscription);
            const isPaidPlan = subscription?.planId === 'monthly' || subscription?.planId === 'lifetime';

            return (
                <>
                    <p className={`${styles.loggedInText} ${styles.description}`}>
                        Logged in as:
                        <br />{" "}
                        <strong className={styles.loggedInEmail}>
                            {authState.email || "N/A"}
                        </strong>
                    </p>
                    {/* Button Group */}
                    <div className={styles.accountActions}>
                        {/* Conditional Button: Go Pro / Manage Account */}
                        <Button
                            onClick={openAuthPage}
                            // Style as primary action if free, secondary if paid
                            variant={isPaidPlan ? "secondary" : "primary"}
                            size="normal"
                            disabled={isLoading} // Use combined loading
                            className={styles.manageButton} // Apply consistent class if needed
                        >
                            {isPaidPlan ? "Manage Account" : "Go Pro"}
                        </Button>

                        {/* Logout Button */}
                        <Button
                            onClick={handleLogout}
                            variant="ghost"
                            size="normal"
                            disabled={isLoading} // Use combined loading
                            className={styles.logoutButton}
                        >
                            Logout
                        </Button>
                    </div>
                </>
            );
        }
        // ---- Logged Out State ----
        else {
            console.log("Popup: Rendering Logged Out State");
            return (
                <>
                    <p className={styles.description}>
                        Unlock powerful features with a Pro plan.
                    </p>
                    {/* Use Button component here too */}
                    <Button
                        onClick={openAuthPage}
                        variant="primary" // Primary action style
                        disabled={isLoading} // Should be false here, but good practice
                    >
                        Go Pro
                    </Button>
                </>
            );
        }
    };

    // --- Main Return ---
    return (
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
                <p className={`${styles.instructionSubText} ${styles.description}`}>
                    On{" "}
                    <code className={`${styles.kbdCode} ${styles.kbd}`}>
                        chatgpt.com
                    </code>
                    , press:
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
