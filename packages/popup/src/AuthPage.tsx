// packages/popup/src/AuthPage.tsx
import { useState, useEffect } from 'react';
import styles from './AuthPage.module.css'; // Styles for the page layout (header, main)
import { sendMessageToSW } from './utils/swMessenger'; // Messenger with retry
import PricingSection from './components/PricingSection/PricingSection';
import LoginForm from './components/LoginForm/LoginForm';
import AccountInfo from './components/AccountInfo/AccountInfo'; // Import AccountInfo
import Button from './components/Button/Button'; // Button for header

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
interface UserSubscription {
    planId: 'free' | 'monthly' | 'lifetime' | null; // Example plan IDs
    // Add other relevant fields like expiry, status etc.
}

// Defines which main view is currently active
type AuthPageView = 'pricing' | 'login' | 'account';

// --- Component ---
function AuthPage() {
    // State for authentication status (null means not yet checked)
    const [authState, setAuthState] = useState<AuthState | null>(null);
    // State for subscription status (null means not checked or not applicable)
    const [subscription, setSubscription] = useState<UserSubscription | null>(null);
    // State to control which view (Pricing, Login, or Account) is shown
    const [currentView, setCurrentView] = useState<AuthPageView>('pricing'); // Default to pricing
    // Overall loading state for the initial data fetch
    const [isLoading, setIsLoading] = useState<boolean>(true);
    // Error state for fetch/actions
    const [error, setError] = useState<string | null>(null);
    // New state for checkout loading - stores the ID of the plan being checked out
    const [isCheckoutLoading, setIsCheckoutLoading] = useState<string | null>(null);

    // --- Fetch Initial State on Mount ---
    useEffect(() => {
        let isMounted = true;
        console.log("AuthPage: Mounting and fetching initial state...");

        // Check URL params for checkout status first
        const urlParams = new URLSearchParams(window.location.search);
        const checkoutStatus = urlParams.get('checkout');
        if (checkoutStatus === 'success') {
            console.log("AuthPage: Detected checkout success from URL param.");
            setError(null); // Clear other errors
            // You might want to display a temporary success message or directly fetch latest state
        } else if (checkoutStatus === 'cancel') {
            console.log("AuthPage: Detected checkout cancel from URL param.");
            setError("Checkout process was cancelled or failed. Please try again.");
        }
        // Clean the URL params after reading them
        if (checkoutStatus && window.history.replaceState) {
            const cleanUrl = window.location.pathname; // Get path without query string
            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
            console.log("AuthPage: Cleaned checkout status from URL.");
        }


        const fetchInitialData = async () => {
            if (!isMounted) return; // Check mount status before starting
            console.log("AuthPage: fetchInitialData called.");
            setIsLoading(true);
            // Don't clear error if set by URL params above
            // setError(null);

            try {
                // 1. Fetch Auth State
                console.log("AuthPage: Sending GET_AUTH_STATE...");
                const userAuthData = await sendMessageToSW<UserData | null>({ type: "GET_AUTH_STATE" });
                if (!isMounted) return; // Check again after await
                const currentAuthState: AuthState = userAuthData
                    ? { isLoggedIn: true, ...userAuthData }
                    : { isLoggedIn: false, uid: null, email: null };
                setAuthState(currentAuthState);
                console.log("AuthPage: Auth state received:", currentAuthState);

                // 2. Fetch Subscription Status (ONLY if logged in)
                let fetchedSubscription: UserSubscription | null = null;
                let viewAfterFetch: AuthPageView = 'pricing'; // Assume pricing initially

                if (currentAuthState.isLoggedIn && currentAuthState.uid) {
                    viewAfterFetch = 'account'; // If logged in, aim for account view
                    try {
                        // --- !!! REPLACE WITH ACTUAL SUBSCRIPTION FETCH !!! ---
                        console.log("AuthPage: Fetching subscription status for UID:", currentAuthState.uid);
                        // Example: const subData = await sendMessageToSW<UserSubscription | null>({ type: "GET_SUBSCRIPTION_STATUS", payload: { uid: currentAuthState.uid } });
                        await new Promise(resolve => setTimeout(resolve, 150)); // Simulate network delay
                        // --- Simulate different states ---
                        fetchedSubscription = { planId: null }; // Simulate free user
                        // fetchedSubscription = { planId: 'monthly' };
                        // fetchedSubscription = { planId: 'lifetime' };
                        // --- End Simulation ---

                        if (!isMounted) return;
                        setSubscription(fetchedSubscription);
                        console.log("AuthPage: Subscription status received:", fetchedSubscription);

                    } catch (subError: any) {
                        console.error("AuthPage: Failed to fetch subscription status:", subError);
                        if (isMounted) {
                            // Show error, but still likely want to show account page if logged in
                            setError("Could not load subscription details.");
                            setSubscription(null); // Ensure subscription is null on error
                        }
                    }
                } else {
                    // Not logged in
                    if (isMounted) setSubscription(null); // Ensure subscription is null
                }

                // 3. Set the view (respecting initial checkout status if applicable)
                if (isMounted) {
                    if (checkoutStatus === 'success') {
                        setCurrentView('account'); // Force account view on success
                    } else if (checkoutStatus === 'cancel') {
                        setCurrentView('pricing'); // Force pricing view on cancel
                    } else {
                        setCurrentView(viewAfterFetch); // Set view based on login/sub status
                    }
                }

            } catch (authError: any) {
                if (isMounted) {
                    setError(authError.message || "Failed to load account status.");
                    setAuthState({ isLoggedIn: false, uid: null, email: null });
                    setCurrentView('pricing'); // Fallback to pricing on critical auth error
                }
                console.error("AuthPage: Error fetching initial auth data:", authError);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                    console.log("AuthPage: Initial data fetch complete. Final View:", currentView);
                }
            }
        };

        fetchInitialData();

        // Optional: Listener for real-time updates from SW
        const messageListener = (message: any) => {
            if (!isMounted) return;
            console.log("AuthPage: Received message from SW", message);
            if (message.type === 'AUTH_STATE_UPDATED') {
                const newAuthState = message.payload;
                setAuthState(newAuthState);
                setIsLoading(false); // Stop loading if we get an auth update
                if (!newAuthState.isLoggedIn) {
                    setCurrentView('pricing');
                    setSubscription(null);
                } else {
                    setCurrentView('account');
                    // TODO: Re-fetch subscription if needed on auth update
                }
            } else if (message.type === 'SUBSCRIPTION_UPDATED') {
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
            if (!userData.uid) { // Should not happen, but guard anyway
                setError("Login succeeded but user ID is missing.");
                setIsLoading(false);
                setCurrentView('pricing'); // Fallback
                return;
            }
            try {
                console.log("AuthPage: Fetching subscription status after login for UID:", userData.uid);
                // --- !!! REPLACE WITH ACTUAL SUBSCRIPTION FETCH !!! ---
                await new Promise(resolve => setTimeout(resolve, 150)); // Simulate
                const subData: UserSubscription = { planId: null }; // Simulate free
                // --- End Simulation ---
                setSubscription(subData);
                setCurrentView('account'); // Switch to account view *after* getting sub status
            } catch (subError: any) {
                console.error("AuthPage: Failed to fetch subscription after login:", subError);
                setError("Logged in, but failed to load subscription details.");
                setSubscription(null); // Set to null on error
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
            setAuthState({ isLoggedIn: false, uid: null, email: null });
            setSubscription(null);
            setCurrentView('pricing');
        } catch (err: any) {
            setError(err.message || "Logout failed.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectPlan = async (planId: 'monthly' | 'lifetime') => {
        if (isCheckoutLoading || !authState?.isLoggedIn) return;

        setError(null);
        setIsCheckoutLoading(planId);

        try {
            console.log(`AuthPage: Sending CREATE_CHECKOUT_SESSION for plan ${planId}`);
            const result = await sendMessageToSW<{ checkoutUrl: string }>({
                type: "CREATE_CHECKOUT_SESSION",
                payload: { planId: planId } // Send the plan identifier ('monthly' or 'lifetime')
            });

            if (result?.checkoutUrl) {
                console.log("AuthPage: Received checkout URL, redirecting...", result.checkoutUrl);
                // Redirect the current tab
                window.location.href = result.checkoutUrl;
                // Page will navigate away, no need to reset loading state here usually
            } else {
                throw new Error("Did not receive a valid checkout URL.");
            }

        } catch (err: any) {
            console.error(`AuthPage: Error creating checkout session for ${planId}:`, err);
            setError(err.message || "Could not initiate checkout. Please try again.");
            setIsCheckoutLoading(null); // Reset loading state on error ONLY
        }
    };

    // --- Render Logic ---
    const renderContent = () => {
        // **Priority 1: Show Loading State**
        if (isLoading || authState === null) {
            return <div className={styles.loading}>Loading Account...</div>;
        }

        // **Priority 2: Show Critical Error (if not related to login attempt itself)**
        // (We handle login-specific errors within the LoginForm component)
        if (error && currentView !== 'login') {
            return (
                <div className={styles.container}>
                    <p className={styles.criticalError}>Error: {error}</p>
                    {/* Optional: Add a retry button or guide user */}
                    {!authState.isLoggedIn && (
                        <Button onClick={() => setCurrentView('login')}>Go to Login</Button>
                    )}
                </div>
            );
        }

        // **Priority 3: Render based on currentView**
        switch (currentView) {
            case 'login':
                return (
                    <div className={styles.container}>
                        <LoginForm onSuccess={handleLoginSuccess} />
                    </div>
                );
            case 'account':
                if (authState.isLoggedIn) {
                    return (
                        <div className={styles.container}>
                            {/* Show subscription error here if it occurred */}
                            {error && <p className={styles.criticalError}>Error: {error}</p>}
                            <AccountInfo
                                email={authState.email}
                                planId={subscription?.planId ?? null}
                                onLogout={handleLogout}
                                isLoading={isLoading} // Pass overall loading state for logout button
                            />
                        </div>
                    );
                }
                // Fallback if somehow viewing 'account' but not logged in
                console.warn("AuthPage: Attempted to render account view while not logged in. Switching to pricing.");
                setCurrentView('pricing');
                return <div className={styles.loading}>Redirecting...</div>; // Temporary state

            case 'pricing':
            default:
                return (
                    <PricingSection
                        userSubscription={subscription}
                        isLoggedIn={authState.isLoggedIn}
                        isLoadingCheckout={isCheckoutLoading}
                        onSelectPlan={handleSelectPlan}
                        onLoginRequired={() => { setError(null); setCurrentView('login'); }}
                    />
                );
        }
    };

    // Determine if account button should be shown in header
    const showAccountButton = authState?.isLoggedIn ?? false;

    return (
        <div className={styles.pageContainer}>
            <header className={styles.header}>
                <div className={styles.headerTitle}>ChatGPT Reverse Account</div>
                <nav className={styles.nav}>
                    {/* Pricing Tab */}
                    <Button
                        variant="ghost"
                        onClick={() => !isLoading && setCurrentView('pricing')}
                        disabled={isLoading || isCheckoutLoading !== null} // Disable during any loading
                        aria-current={currentView === 'pricing' ? 'page' : undefined}
                    >
                        Pricing
                    </Button>

                    {/* Account or Login Tab */}
                    {showAccountButton ? (
                        <Button
                            variant="ghost"
                            onClick={() => !isLoading && setCurrentView('account')}
                            disabled={isLoading || isCheckoutLoading !== null}
                            aria-current={currentView === 'account' ? 'page' : undefined}
                        >
                            Account
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            onClick={() => !isLoading && setCurrentView('login')}
                            disabled={isLoading || isCheckoutLoading !== null}
                            aria-current={currentView === 'login' ? 'page' : undefined}
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
