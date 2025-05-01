// packages/popup/src/AuthPage.tsx
import { useState, useEffect } from "react";
import styles from "./AuthPage.module.css"; // Styles for the page layout (header, main)
import { sendMessageToSW } from "./utils/swMessenger"; // Messenger with retry
import PricingSection from "./components/PricingSection/PricingSection";
import LoginForm from "./components/LoginForm/LoginForm";
import AccountInfo from "./components/AccountInfo/AccountInfo"; // Import AccountInfo
import Button from "./components/Button/Button"; // Button for header

// --- Types ---
interface UserData {
    uid: string;
    email: string | null;
}
interface AuthState {
    isLoggedIn: boolean;
    uid: string | null;
    email: string | null;
}
// Placeholder - replace with your actual subscription structure
// Ensure this matches what your SW might return for GET_SUBSCRIPTION_STATUS if you implement it
interface UserSubscription {
    planId: "free" | "monthly" | "lifetime" | null; // Example plan IDs
    // Add other relevant fields like status, expiry, etc.
    // status?: 'active' | 'trialing' | 'past_due' | 'canceled';
    // role?: string; // from Stripe metadata potentially
}

// Defines which main view is currently active
type AuthPageView = "pricing" | "login" | "account";

// --- Component ---
function AuthPage() {
    // State for authentication status (null means not yet checked)
    const [authState, setAuthState] = useState<AuthState | null>(null);
    // State for subscription status (null means not checked or not applicable)
    // You might need a more specific message type like 'GET_SUBSCRIPTION_STATUS'
    const [subscription, setSubscription] = useState<UserSubscription | null>(
        null,
    );
    // State to control which view (Pricing, Login, or Account) is shown
    const [currentView, setCurrentView] = useState<AuthPageView>("pricing"); // Default to pricing
    // Overall loading state for the initial data fetch
    const [isLoading, setIsLoading] = useState<boolean>(true);
    // Error state for fetch/actions
    const [error, setError] = useState<string | null>(null);
    // New state for checkout loading - stores the ID of the plan being checked out
    const [isCheckoutLoading, setIsCheckoutLoading] = useState<
        "monthly" | "lifetime" | null
    >(null); // Store the specific plan ID being loaded

    // --- Fetch Initial State on Mount ---
    useEffect(() => {
        let isMounted = true;
        console.log("AuthPage: Mounting and fetching initial state...");

        // Check URL params for checkout status first
        const urlParams = new URLSearchParams(window.location.search);
        const checkoutStatus = urlParams.get("checkout");
        const sessionId = urlParams.get("session_id"); // Optional session ID

        if (checkoutStatus === "success") {
            console.log("AuthPage: Detected checkout success from URL param.", sessionId ? `Session ID: ${sessionId}` : '');
            setError(null); // Clear other errors
            // Display a temporary success message or automatically refresh state
            // (Initial fetch below will likely handle refreshing state)
        } else if (checkoutStatus === "cancel") {
            console.log("AuthPage: Detected checkout cancel from URL param.");
            setError(
                "Checkout process was cancelled or failed. Please try again.",
            );
        }
        // Clean the URL params after reading them
        if (checkoutStatus && window.history.replaceState) {
            const cleanUrl = window.location.pathname; // Get path without query string
            window.history.replaceState({ path: cleanUrl }, "", cleanUrl);
            console.log("AuthPage: Cleaned checkout status from URL.");
        }

        const fetchInitialData = async () => {
            if (!isMounted) return; // Check mount status before starting
            console.log("AuthPage: fetchInitialData called.");
            setIsLoading(true);
            // Don't clear error if set by URL params above (unless it was success)
            if (checkoutStatus !== 'cancel') {
                setError(null);
            }

            try {
                // 1. Fetch Auth State
                console.log("AuthPage: Sending GET_AUTH_STATE...");
                const userAuthData = await sendMessageToSW<UserData | null>({
                    type: "GET_AUTH_STATE",
                });
                if (!isMounted) return; // Check again after await
                const currentAuthState: AuthState = userAuthData
                    ? { isLoggedIn: true, ...userAuthData }
                    : { isLoggedIn: false, uid: null, email: null };
                setAuthState(currentAuthState);
                console.log("AuthPage: Auth state received:", currentAuthState);

                // 2. Fetch Subscription Status (ONLY if logged in)
                //    Placeholder - you'll need a way to get this from Firestore/SW
                let fetchedSubscription: UserSubscription | null = null;
                let viewAfterFetch: AuthPageView = "pricing"; // Assume pricing initially

                if (currentAuthState.isLoggedIn && currentAuthState.uid) {
                    viewAfterFetch = "account"; // If logged in, aim for account view
                    try {
                        // --- !!! IMPLEMENT ACTUAL SUBSCRIPTION FETCH !!! ---
                        console.log(
                            "AuthPage: Fetching subscription status for UID:",
                            currentAuthState.uid,
                        );
                        // Example (replace with your actual SW message type):
                        // const subData = await sendMessageToSW<UserSubscription | null>({
                        //     type: "GET_SUBSCRIPTION_STATUS", // <-- You need to implement this message type in SW
                        //     payload: { uid: currentAuthState.uid }
                        // });
                        // fetchedSubscription = subData;


                        if (!isMounted) return;
                        setSubscription(fetchedSubscription);
                        console.log(
                            "AuthPage: Subscription status received:",
                            fetchedSubscription,
                        );

                    } catch (subError: any) {
                        console.error(
                            "AuthPage: Failed to fetch subscription status:",
                            subError,
                        );
                        if (isMounted) {
                            setError("Could not load subscription details. Please refresh.");
                            setSubscription(null); // Ensure subscription is null on error
                        }
                    }
                } else {
                    // Not logged in
                    if (isMounted) setSubscription(null); // Ensure subscription is null
                }

                // 3. Set the view
                if (isMounted) {
                    // Override view based on login status or checkout status
                     if (checkoutStatus === 'success' && currentAuthState.isLoggedIn) {
                         setCurrentView('account'); // Force account view on success if logged in
                     } else if (checkoutStatus === 'cancel') {
                         setCurrentView('pricing'); // Force pricing view on cancel
                     } else {
                         setCurrentView(viewAfterFetch); // Set view based on login/sub status otherwise
                     }
                }

            } catch (authError: any) {
                if (isMounted) {
                    setError(
                        authError.message || "Failed to load account status.",
                    );
                    setAuthState({ isLoggedIn: false, uid: null, email: null });
                    setSubscription(null);
                    setCurrentView("pricing"); // Fallback to pricing on critical auth error
                }
                console.error(
                    "AuthPage: Error fetching initial auth data:",
                    authError,
                );
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                    console.log(
                        "AuthPage: Initial data fetch complete. Final View:", currentView
                    );
                }
            }
        };

        fetchInitialData();

        // Listener for real-time updates from SW
        const messageListener = (message: any) => {
            if (!isMounted) return;
            console.log("AuthPage: Received message from SW", message?.type);
            if (message.type === 'AUTH_STATE_UPDATED') {
                const newAuthState = message.payload;
                setAuthState(newAuthState);
                // Don't set loading to false here necessarily, wait for initial fetch
                if (!newAuthState.isLoggedIn) {
                    console.log("AuthPage: Auth updated to logged out, switching view.");
                    setCurrentView('pricing');
                    setSubscription(null);
                    setError(null); // Clear errors on logout
                    setIsLoading(false); // Can stop loading on explicit logout
                } else if (!isLoading) { // Only switch view if initial load is done
                    console.log("AuthPage: Auth updated to logged in, switching view.");
                    setCurrentView('account');
                    // TODO: Re-fetch subscription if needed here
                }
            } else if (message.type === 'SUBSCRIPTION_UPDATED') { // If you implement this
                 console.log("AuthPage: Subscription updated", message.payload);
                setSubscription(message.payload);
                // Ensure user sees account page after subscription update if logged in
                if (authState?.isLoggedIn) {
                    setCurrentView('account');
                }
            }
        };
        chrome.runtime.onMessage.addListener(messageListener);


        return () => {
            isMounted = false;
            chrome.runtime.onMessage.removeListener(messageListener);
            console.log("AuthPage: Unmounted.");
        };
    }, []); // Run only once on mount

    // --- Handlers ---
    const handleLoginSuccess = (userData: UserData) => {
        console.log("AuthPage: Login/Register successful callback", userData);
        const newAuthState = { isLoggedIn: true, ...userData };
        setAuthState(newAuthState);
        setError(null);
        setIsLoading(true); // Show loading while fetching subscription

        // --- Fetch subscription status AFTER successful login/register ---
        const fetchSubAfterLogin = async () => {
            if (!userData.uid) { // Guard
                setError("Login succeeded but user ID is missing.");
                setIsLoading(false);
                setCurrentView('pricing');
                return;
            }
            try {
                console.log("AuthPage: Fetching subscription status after login for UID:", userData.uid);
                // --- !!! IMPLEMENT ACTUAL SUBSCRIPTION FETCH !!! ---
                // const subData = await sendMessageToSW<UserSubscription | null>({ type: "GET_SUBSCRIPTION_STATUS", payload: { uid: userData.uid } });
                // setSubscription(subData);

                // --- Simulation (REMOVE THIS) ---
                await new Promise(resolve => setTimeout(resolve, 150));
                const subData: UserSubscription = { planId: null }; // Simulate free
                setSubscription(subData);
                // --- End Simulation ---

                setCurrentView('account'); // Switch view after getting sub status
            } catch (subError: any) {
                console.error("AuthPage: Failed to fetch subscription after login:", subError);
                setError("Logged in, but failed to load subscription details.");
                setSubscription(null);
                setCurrentView('account'); // Still go to account view, show error there
            } finally {
                setIsLoading(false);
            }
        };
        fetchSubAfterLogin();
        // --- End Subscription Fetch ---
    };

    const handleLogout = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await sendMessageToSW({ type: "LOGOUT_USER" });
            // Listener will handle setting state and view
        } catch (err: any) {
            setError(err.message || "Logout failed.");
            setIsLoading(false); // Ensure loading stops on error
        }
        // Don't manually set state here if listener is reliable
    };

    const handleSelectPlan = async (planId: "monthly" | "lifetime") => {
        // Prevent action if already processing or not logged in
        if (isCheckoutLoading || !authState?.isLoggedIn) return;

        setError(null);
        setIsCheckoutLoading(planId); // Set loading specifically for this plan

        try {
            console.log(
                `AuthPage: Requesting checkout URL for plan ${planId}...`,
            );
            // Expect a string URL directly from the SW now
            const checkoutUrl = await sendMessageToSW<string>({
                type: "CREATE_CHECKOUT_SESSION", // SW listens for this type
                payload: { planId: planId },
            });

            // Validate the response
            if (checkoutUrl && typeof checkoutUrl === 'string' && checkoutUrl.startsWith('http')) {
                console.log(
                    "AuthPage: Received valid checkout URL, redirecting...",
                    checkoutUrl,
                );
                // Redirect the current tab to Stripe Checkout
                window.location.href = checkoutUrl;
                // On successful navigation, the browser takes over. No need to reset loading state here.
            } else {
                // Handle cases where SW might return success:true but data:null or invalid data
                console.error("AuthPage: Received invalid checkout URL response:", checkoutUrl);
                throw new Error("Failed to retrieve a valid checkout URL. Please try again.");
            }

        } catch (err: any) {
            console.error(
                `AuthPage: Error getting checkout URL for ${planId}:`,
                err,
            );
            setError(
                err.message || "Could not initiate checkout. Please try again.",
            );
            // Reset loading state *only on error*
            setIsCheckoutLoading(null);
        }
        // Do NOT reset loading state on success, as the page navigates away.
    };

    // --- Render Logic ---
    const renderContent = () => {
        // **Priority 1: Show Loading State**
        if (isLoading || authState === null) { // Show loading until auth state is known
            return <div className={styles.loading}>Loading Account...</div>;
        }

        // **Priority 2: Show Critical Error (if not login view)**
        // Login form handles its own errors. Show general errors otherwise.
        if (error && currentView !== 'login') {
            return (
                <div className={styles.container}>
                    <p className={styles.criticalError}>Error: {error}</p>
                    {!authState.isLoggedIn && (
                        <Button onClick={() => {setError(null); setCurrentView('login');}}>
                             Retry Login
                        </Button>
                    )}
                </div>
            );
        }

        // **Priority 3: Render based on currentView**
        switch (currentView) {
            case 'login':
                return (
                    <div className={styles.container}>
                        {/* LoginForm handles its own internal error display */}
                        <LoginForm onSuccess={handleLoginSuccess} />
                    </div>
                );
            case 'account':
                // Only render account if logged in, otherwise redirect implicitly
                if (authState.isLoggedIn) {
                    return (
                        <div className={styles.container}>
                            {/* Show general error if present (e.g., sub fetch failed) */}
                            {error && <p className={styles.criticalError}>Error: {error}</p>}
                            <AccountInfo
                                email={authState.email}
                                planId={subscription?.planId ?? null} // Use null if subscription not loaded
                                onLogout={handleLogout}
                                isLoading={isLoading} // Pass overall loading state
                            />
                        </div>
                    );
                }
                // Implicit redirect if somehow in 'account' view but not logged in
                console.warn("AuthPage: Attempted to render account view while not logged in. Switching to pricing.");
                 // Use useEffect to handle state transitions more cleanly if this happens often
                setCurrentView('pricing');
                return <div className={styles.loading}>Redirecting...</div>; // Show temp state

            case 'pricing':
            default:
                return (
                     // Pricing section handles displaying plan info and buttons
                    <PricingSection
                        userSubscription={subscription}
                        isLoggedIn={authState.isLoggedIn}
                        isLoadingCheckout={isCheckoutLoading} // Pass the specific loading plan ID
                        onSelectPlan={handleSelectPlan}
                        onLoginRequired={() => { setError(null); setCurrentView('login'); }} // Switch to login view
                    />
                );
        }
    };

    // Determine if account button should be shown in header
    const showAccountButton = authState?.isLoggedIn ?? false; // Handle null state during init

    return (
        <div className={styles.pageContainer}>
            <header className={styles.header}>
                <div className={styles.headerTitle}>
                    ChatGPT Reverse Account
                </div>
                <nav className={styles.nav}>
                    {/* Pricing Tab */}
                    <Button
                        variant="ghost"
                        onClick={() => !isLoading && setCurrentView("pricing")}
                        // Disable if initial load is happening OR a checkout is loading
                        disabled={isLoading || isCheckoutLoading !== null}
                        aria-current={
                            currentView === "pricing" ? "page" : undefined
                        }
                    >
                        Pricing
                    </Button>

                    {/* Account or Login Tab */}
                    {showAccountButton ? (
                        <Button
                            variant="ghost"
                            onClick={() =>
                                !isLoading && setCurrentView("account")
                            }
                            disabled={isLoading || isCheckoutLoading !== null}
                            aria-current={
                                currentView === "account" ? "page" : undefined
                            }
                        >
                            Account
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            onClick={() =>
                                !isLoading && setCurrentView("login")
                            }
                            disabled={isLoading || isCheckoutLoading !== null}
                            aria-current={
                                currentView === "login" ? "page" : undefined
                            }
                        >
                            Login/Register
                        </Button>
                    )}
                </nav>
            </header>
            <main className={styles.mainContent}>
                {renderContent()} {/* Render content based on state */}
            </main>
        </div>
    );
}

export default AuthPage;
