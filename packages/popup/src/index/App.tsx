// packages/popup/src/index/App.tsx
import { useState, useEffect } from "react";
import logo from "../assets/logo.svg";
import { sendMessageToSW } from "../utils/swMessenger";
import { MSG } from "@shared"; // Import message constants
import styles from "./App.module.css";
import Button from "../components/Button/Button";

// --- Type Definitions (Align with shared types if possible) ---
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
    status?: string | null; // Keep status if relevant for display or logic later
}

// --- Component ---

function App() {
    // --- State ---
    const [authState, setAuthState] = useState<AuthState>({
        isLoggedIn: false,
        uid: null,
        email: null,
    });
    const [subscription, setSubscription] = useState<UserSubscription | null>(
        null,
    );
    const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
    const [isLoadingSub, setIsLoadingSub] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // --- Effects ---
    useEffect(() => {
        console.log("Popup: useEffect started.");
        let isMounted = true;

        // Function to fetch subscription status
        const fetchSubscriptionStatus = async (userId: string | null) => {
            // Guard against running if not mounted or user isn't actually logged in
            if (!isMounted || !userId) {
                 console.log("Popup: Skipping subscription fetch (not mounted or no userId).");
                 setIsLoadingSub(false); // Ensure loading stops if skipped
                 setSubscription(null); // Ensure subscription is cleared if no userId
                 return;
            }

            console.log("Popup: Fetching subscription status for user:", userId);
            setIsLoadingSub(true);
            setError(null); // Clear previous errors before fetching sub

            try {
                const subData = await sendMessageToSW<UserSubscription | null>({
                    type: MSG.GET_SUBSCRIPTION_STATUS, // <-- Use constant
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
                 // Be more specific about the error if possible
                if (subError.message?.includes('unauthenticated')) {
                     console.warn("Popup: Subscription fetch failed due to unauthenticated state (likely during logout race condition). Assuming free.");
                     setSubscription({ planId: "free", status: null });
                } else {
                    setError(subError.message || "Failed to load subscription details.");
                    setSubscription(null); // Reset subscription on other errors
                }
            } finally {
                if (isMounted) {
                    setIsLoadingSub(false);
                }
            }
        };

        // Function to fetch initial auth state
        const fetchAuthState = async () => {
            if (!isMounted) return;
            // Don't reset loading here, let the finally block handle it
            setError(null);

            try {
                console.log("Popup: Sending GET_AUTH_STATE message...");
                // Get initial auth state
                const userData = await sendMessageToSW<UserData | null>({
                    type: MSG.GET_AUTH_STATE, // <-- Use constant
                });
                console.log("Popup: Received initial auth state response:", userData);
                if (!isMounted) return;

                const currentAuthState = userData
                    ? { isLoggedIn: true, ...userData }
                    : { isLoggedIn: false, uid: null, email: null };
                setAuthState(currentAuthState);

                // If logged in, immediately trigger subscription fetch
                if (currentAuthState.isLoggedIn && currentAuthState.uid) {
                    // Don't await here, let it update state asynchronously
                    fetchSubscriptionStatus(currentAuthState.uid);
                } else {
                    // If not logged in, ensure subscription is cleared and sub loading stopped
                    setSubscription(null);
                    setIsLoadingSub(false);
                }
            } catch (authError: any) {
                if (!isMounted) return;
                console.error("Popup: Error fetching auth state:", authError);
                setError(
                    authError.message || "Failed to fetch authentication status.",
                );
                setAuthState({ isLoggedIn: false, uid: null, email: null });
                setSubscription(null);
                setIsLoadingSub(false);
            } finally {
                if (isMounted) {
                    setIsLoadingAuth(false); // Auth loading is finished after initial check
                }
            }
        };

        setIsLoadingAuth(true); // Set loading true *before* starting the async fetch
        fetchAuthState();

        // --- SW Message Listener ---
        const messageListener = (message: any) => {
            if (!isMounted) return;
            const messageType = message?.type; // Safe access
            console.log("Popup: Received message from SW:", messageType);

            if (messageType === MSG.AUTH_STATE_UPDATED) { // <-- Use constant
                const newAuthState: AuthState = message.payload;
                console.log("Popup: Processing AUTH_STATE_UPDATED", newAuthState);
                const wasLoggedIn = authState.isLoggedIn; // Check previous state before setting new one
                setAuthState(newAuthState);
                setError(null);

                if (newAuthState.isLoggedIn) {
                    // If user just logged in OR state confirmed as logged in, fetch/re-fetch sub
                    if (!wasLoggedIn || subscription === null) { // Fetch if just logged in or sub is unknown
                         fetchSubscriptionStatus(newAuthState.uid);
                    }
                } else {
                    // Just logged out
                    setSubscription(null);
                    setIsLoadingSub(false);
                }
                setIsLoadingAuth(false); // Auth loading definitely finished

            } else if (messageType === MSG.SUBSCRIPTION_UPDATED) { // <-- Use constant
                const subPayload: UserSubscription | null = message.payload;
                console.log("Popup: Processing SUBSCRIPTION_UPDATED", subPayload);
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
                setIsLoadingSub(false); // Sub loading finished
                setError(null);
            }
        };
        chrome.runtime.onMessage.addListener(messageListener);

        // --- Cleanup ---
        return () => {
            console.log("Popup: Unmounting. Cleaning up listener.");
            isMounted = false;
            chrome.runtime.onMessage.removeListener(messageListener);
        };
        // Re-run effect if authState.isLoggedIn changes *after* initial mount
        // This helps ensure subscription is fetched if login happens while popup is open
    }, []); // Keep empty deps array for initial load + listener setup


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
        setIsLoadingAuth(true); // Show loading during logout
        setIsLoadingSub(false); // Stop any sub loading
        setSubscription(null); // Clear subscription state
        setError(null);
        try {
            await sendMessageToSW({ type: MSG.LOGOUT_USER }); // <-- Use constant
            // Listener will set authState to logged out and finish loading state
        } catch (error: any) {
            setError(error.message || "Logout failed.");
            setIsLoadingAuth(false); // Re-enable UI if logout call fails
        }
    };

    // --- Render Helper ---
    const renderAccountSection = () => {
        // Determine overall loading state
        const isLoading = isLoadingAuth || (authState.isLoggedIn && isLoadingSub);

        // 1. Show Loading State
        if (isLoading) {
            console.log("Popup: Rendering Loading State");
            return (
                <p className={styles.description}>Loading account status...</p>
            );
        }

        // 2. Show Error State (if not loading)
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

        // 3. Show Logged In State (if not loading and no error)
        if (authState.isLoggedIn) {
            console.log("Popup: Rendering Logged In State. Sub:", subscription);
            // Determine if paid AFTER loading/error checks
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
                            onClick={openAuthPage} // Always goes to auth.html
                            variant={isPaidPlan ? "secondary" : "primary"}
                            size="normal"
                            // Button component already handles disabled state internally via props
                            // disabled={isLoading} // We already checked isLoading above
                            className={styles.manageButton} // Use manageButton class for consistent styling/flex
                        >
                            {isPaidPlan ? "Manage Account" : "Go Pro"}
                        </Button>

                        {/* Logout Button */}
                        <Button
                            onClick={handleLogout}
                            variant="ghost"
                            size="normal"
                            // disabled={isLoading} // Already checked isLoading
                            className={styles.logoutButton}
                        >
                            Logout
                        </Button>
                    </div>
                </>
            );
        }
        // 4. Show Logged Out State (if not loading, no error, not logged in)
        else {
            console.log("Popup: Rendering Logged Out State");
            return (
                <>
                    <p className={styles.description}>
                        Unlock powerful features with a Pro plan.
                    </p>
                    <Button
                        onClick={openAuthPage}
                        variant="primary"
                        // disabled={isLoading} // isLoading should be false here
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
