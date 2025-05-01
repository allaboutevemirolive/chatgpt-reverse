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

    // --- Fetch Initial State on Mount ---
    useEffect(() => {
        let isMounted = true;
        const fetchInitialData = async () => {
            console.log("AuthPage: Fetching initial state...");
            if (isMounted) {
                 setIsLoading(true);
                 setError(null);
            }
            try {
                // 1. Fetch Auth State
                const userAuthData = await sendMessageToSW<UserData | null>({ type: "GET_AUTH_STATE" });
                const currentAuthState: AuthState = userAuthData
                    ? { isLoggedIn: true, ...userAuthData }
                    : { isLoggedIn: false, uid: null, email: null };

                if (!isMounted) return; // Exit if component unmounted during async call
                setAuthState(currentAuthState);
                console.log("AuthPage: Auth state received:", currentAuthState);

                // 2. Fetch Subscription Status (ONLY if logged in)
                let initialView: AuthPageView = 'pricing'; // Default view if not logged in
                if (currentAuthState.isLoggedIn && currentAuthState.uid) {
                    try {
                         // --- !!! REPLACE WITH ACTUAL SUBSCRIPTION FETCH !!! ---
                         console.log("AuthPage: Fetching subscription status for UID:", currentAuthState.uid);
                         // const subData = await sendMessageToSW<UserSubscription | null>({ type: "GET_SUBSCRIPTION", payload: { uid: currentAuthState.uid } });
                         // --- Simulate fetching for now ---
                         await new Promise(resolve => setTimeout(resolve, 150)); // Simulate network delay
                         const subData: UserSubscription = { planId: null }; // Example: Simulate a free user
                         // const subData: UserSubscription = { planId: 'monthly' };
                         // --- End Simulation ---

                         if (isMounted) setSubscription(subData);
                         console.log("AuthPage: Subscription status received:", subData);
                         initialView = 'account'; // If logged in, default to account view
                    } catch (subError: any) {
                         console.error("AuthPage: Failed to fetch subscription status:", subError);
                          if (isMounted) setError("Could not load subscription details.");
                         // Keep initialView as 'pricing' or maybe 'account' with an error message? Decide UX.
                         initialView = 'account'; // Let's default to account view even if sub fails, show error there
                    }
                } else {
                     // Not logged in
                     if (isMounted) setSubscription(null); // Ensure subscription is null
                }

                 // 3. Set the initial view based on login status
                 if (isMounted) setCurrentView(initialView);

            } catch (authError: any) {
                if (isMounted) {
                     setError(authError.message || "Failed to load account status.");
                     setAuthState({ isLoggedIn: false, uid: null, email: null }); // Assume not logged in on error
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

        // Optional: Listener for real-time updates from SW (e.g., after payment)
        const messageListener = (message: any) => {
             if (!isMounted) return;
             if (message.type === 'AUTH_STATE_UPDATED') { // If SW pushes auth changes
                 const newAuthState = message.payload;
                 setAuthState(newAuthState);
                 if (!newAuthState.isLoggedIn) {
                     setCurrentView('pricing');
                     setSubscription(null);
                 } else {
                     setCurrentView('account');
                     // Optionally re-fetch subscription here if it might change on login
                 }
             } else if (message.type === 'SUBSCRIPTION_UPDATED') { // If SW pushes sub changes
                 setSubscription(message.payload);
                 // Optionally switch view if needed, e.g., ensure they see account after purchase
                 if(authState?.isLoggedIn) {
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
        setIsLoading(true); // Show loading while potentially fetching subscription

        // --- !!! Fetch subscription status AFTER successful login/register !!! ---
        const fetchSubAfterLogin = async () => {
            try {
                 console.log("AuthPage: Fetching subscription status after login for UID:", userData.uid);
                 // const subData = await sendMessageToSW<UserSubscription | null>({ type: "GET_SUBSCRIPTION", payload: { uid: userData.uid } });
                 await new Promise(resolve => setTimeout(resolve, 150)); // Simulate
                 const subData: UserSubscription = { planId: null }; // Simulate free
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
            setCurrentView('pricing'); // Go back to pricing after logout
        } catch (err: any) {
            setError(err.message || "Logout failed.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectPlan = (planId: string) => {
        setError(null);
        console.log(`AuthPage: Plan selected - ${planId}. Triggering payment flow...`);
        // --- !!! PLACEHOLDER for Payment Initiation !!! ---
        alert(`Initiate payment for plan: ${planId}. (Integration needed)`);
        // --- !!! END PLACEHOLDER !!! ---
    };

    // --- Render Logic ---
    const renderContent = () => {
        // Show loading indicator until initial fetch is complete
        if (isLoading || authState === null) {
             return <div className={styles.loading}>Loading Account...</div>;
        }

         // Show critical fetch error if it happened (and not trying to log in)
         if (error && currentView !== 'login') {
             return (
                 <div className={styles.container}> {/* Use container for centering */}
                     <p className={styles.criticalError}>Error loading page: {error}</p>
                     {/* Optionally add a retry button */}
                 </div>
             );
         }

        // Render based on the current view state
        switch (currentView) {
            case 'login':
                return (
                    <div className={styles.container}> {/* Center login form */}
                        <LoginForm onSuccess={handleLoginSuccess} />
                    </div>
                );
            case 'account':
                // Should only be in this view if logged in
                if (authState.isLoggedIn) {
                    return (
                         <div className={styles.container}> {/* Center account info */}
                            <AccountInfo
                                email={authState.email}
                                planId={subscription?.planId ?? null}
                                onLogout={handleLogout}
                                isLoading={isLoading} // Pass loading state for logout button potentially
                            />
                         </div>
                    );
                }
                // Fallback if state is inconsistent (shouldn't happen with correct logic)
                setCurrentView('pricing'); // Go back to pricing if trying to show account but not logged in
                return null; // Render nothing this cycle, useEffect will correct next cycle
            case 'pricing':
            default:
                return <PricingSection
                            userSubscription={subscription}
                            isLoggedIn={authState.isLoggedIn} // Use the fetched state
                            onSelectPlan={handleSelectPlan}
                            onLoginRequired={() => { setError(null); setCurrentView('login'); }} // Clear errors when switching to login
                       />;
        }
    };

    return (
        <div className={styles.pageContainer}>
            <header className={styles.header}>
                 <div className={styles.headerTitle}>ChatGPT Reverse Account</div>
                 <nav className={styles.nav}>
                     {/* Pricing Tab */}
                     <Button
                         variant="ghost"
                         onClick={() => !isLoading && setCurrentView('pricing')} // Prevent switching while loading
                         disabled={isLoading}
                         aria-current={currentView === 'pricing' ? 'page' : undefined}
                     >
                         Pricing
                     </Button>

                     {/* Account or Login Tab */}
                     {authState?.isLoggedIn ? (
                          <Button
                            variant="ghost"
                            onClick={() => !isLoading && setCurrentView('account')}
                            disabled={isLoading}
                            aria-current={currentView === 'account' ? 'page' : undefined}
                          >
                             Account
                          </Button>
                     ) : (
                         <Button
                            variant="ghost"
                            onClick={() => !isLoading && setCurrentView('login')}
                            disabled={isLoading}
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
