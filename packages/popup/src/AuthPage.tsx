// packages/popup/src/AuthPage.tsx
import { useState, useEffect } from 'react';
import styles from './AuthPage.module.css';
import { sendMessageToSW } from './utils/swMessenger';
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
interface UserSubscription { // Placeholder - replace with actual structure from SW/Backend
    planId: 'free' | 'monthly' | 'lifetime' | null; // Example plan IDs
    // e.g., paidUntil?: number; status?: 'active' | 'canceled' | 'trialing';
}

type AuthPageView = 'pricing' | 'login' | 'account';

// --- Component ---
function AuthPage() {
    const [authState, setAuthState] = useState<AuthState | null>(null); // Start as null until fetched
    const [subscription, setSubscription] = useState<UserSubscription | null>(null); // Start as null
    const [currentView, setCurrentView] = useState<AuthPageView>('pricing'); // Default view
    const [isLoading, setIsLoading] = useState(true); // Overall loading state for the page
    const [error, setError] = useState<string | null>(null);

    // --- Fetch Initial State ---
    useEffect(() => {
        let isMounted = true;
        const fetchInitialData = async () => {
            console.log("AuthPage: Fetching initial state...");
            setIsLoading(true);
            setError(null);
            try {
                // Fetch auth state
                const userAuthData = await sendMessageToSW<UserData | null>({ type: "GET_AUTH_STATE" });
                const currentAuthState = userAuthData ? { isLoggedIn: true, ...userAuthData } : { isLoggedIn: false, uid: null, email: null };
                if (isMounted) setAuthState(currentAuthState);
                console.log("AuthPage: Auth state received:", currentAuthState);

                // Fetch subscription status (IF user is logged in)
                if (currentAuthState.isLoggedIn && currentAuthState.uid) {
                     // --- !!! PLACEHOLDER !!! ---
                     // Replace this with an actual call to your SW/backend
                     // to get the user's subscription status based on their UID.
                     console.log("AuthPage: Fetching subscription status for UID:", currentAuthState.uid);
                     // Example: const subData = await sendMessageToSW<UserSubscription>({ type: "GET_SUBSCRIPTION_STATUS", payload: { uid: currentAuthState.uid } });
                     // For now, simulate different states:
                     // const subData: UserSubscription = { planId: 'monthly' };
                      const subData: UserSubscription = { planId: null }; // Simulate free user
                     // const subData: UserSubscription = { planId: 'lifetime' };
                     // --- !!! END PLACEHOLDER !!! ---

                    if (isMounted) setSubscription(subData);
                    console.log("AuthPage: Subscription status received:", subData);

                    // If logged in, potentially default to 'account' view instead of 'pricing'
                    if (isMounted) setCurrentView('account');

                } else {
                    // Not logged in, ensure subscription is null and default view is pricing
                     if (isMounted) {
                         setSubscription(null);
                         setCurrentView('pricing');
                     }
                }

            } catch (err: any) {
                 if (isMounted) setError(err.message || "Failed to load initial data.");
                 console.error("AuthPage: Error fetching initial data:", err);
            } finally {
                if (isMounted) setIsLoading(false);
                console.log("AuthPage: Initial data fetch complete.");
            }
        };

        fetchInitialData();

        // Optional: Listener for real-time updates (if SW broadcasts them)
        const messageListener = (message: any) => {
             if (!isMounted) return;
             if (message.type === 'AUTH_STATE_UPDATED') {
                 console.log("AuthPage: Received AUTH_STATE_UPDATED", message.payload);
                 if (typeof message.payload?.isLoggedIn === 'boolean') {
                     setAuthState(message.payload);
                     // If user just logged out, switch to pricing view
                     if (!message.payload.isLoggedIn) {
                         setCurrentView('pricing');
                         setSubscription(null);
                     } else {
                         // If user just logged in, refetch subscription & switch view
                         // For simplicity, we might just switch view here and let handleLoginSuccess handle sub fetch
                         setCurrentView('account');
                     }
                 }
             } else if (message.type === 'SUBSCRIPTION_UPDATED') { // Example message type
                 console.log("AuthPage: Received SUBSCRIPTION_UPDATED", message.payload);
                 setSubscription(message.payload);
             }
        };
        chrome.runtime.onMessage.addListener(messageListener);

        return () => { isMounted = false; chrome.runtime.onMessage.removeListener(messageListener); };
    }, []);

    // --- Handlers ---
    const handleLoginSuccess = (userData: UserData) => {
        console.log("AuthPage: Login/Register successful", userData);
        setAuthState({ isLoggedIn: true, ...userData });
        setError(null);
        // TODO: Fetch subscription status *after* successful login/register
        // For now, just switch view
        setCurrentView('account');
        setIsLoading(false); // Ensure loading stops
         // You might want to trigger a fetch of subscription status here
         // fetchSubscriptionStatus(userData.uid);
    };

     const handleLogout = async () => {
        setIsLoading(true); // Indicate loading during logout
        setError(null);
        try {
            await sendMessageToSW({ type: "LOGOUT_USER" });
            setAuthState({ isLoggedIn: false, uid: null, email: null });
            setSubscription(null);
            setCurrentView('pricing'); // Go back to pricing after logout
        } catch (error: any) {
            setError(error.message || "Logout failed.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectPlan = (planId: string) => {
        setError(null); // Clear previous errors
        console.log(`AuthPage: Plan selected - ${planId}. Triggering payment flow...`);
        // --- !!! PLACEHOLDER for Payment Initiation !!! ---
        // Here you would typically:
        // 1. Send a message to the service worker (e.g., { type: 'CREATE_CHECKOUT_SESSION', payload: { planId, uid: authState?.uid } })
        // 2. The SW would call your backend/Firebase Function to create a Stripe Checkout session.
        // 3. The SW would receive the Checkout Session URL back.
        // 4. The SW would send the URL back to this page (or open it directly).
        // 5. This page would redirect the user to the Stripe Checkout URL.
        alert(`Initiate payment for plan: ${planId}. (Integration needed)`);
        // Example using ExtPay (if you choose that route)
        // const extpay = ExtPay('YOUR_EXTENSION_ID');
        // extpay.openPaymentPage(planId); // Use plan IDs matching ExtPay setup
        // --- !!! END PLACEHOLDER !!! ---
    };

    // --- Render Logic ---
    const renderContent = () => {
        if (isLoading) {
            return <div className={styles.loading}>Loading...</div>; // Add a loading indicator style
        }
        if (error && currentView !== 'login') { // Show critical error prominently unless on login screen
             return <p className={styles.criticalError}>Error loading page: {error}</p>;
        }

        switch (currentView) {
            case 'login':
                return <LoginForm onSuccess={handleLoginSuccess} />;
            case 'account':
                // Should only reach here if logged in and not loading/error
                if (authState?.isLoggedIn) {
                     return <AccountInfo
                                email={authState.email}
                                planId={subscription?.planId ?? null} // Pass current plan
                                onLogout={handleLogout}
                                isLoading={isLoading} // Pass loading state for logout button
                            />;
                }
                 // Fallback if somehow account view is shown while logged out
                 setCurrentView('pricing');
                 return null;
            case 'pricing':
            default:
                return <PricingSection
                            userSubscription={subscription}
                            isLoggedIn={authState?.isLoggedIn ?? false}
                            onSelectPlan={handleSelectPlan}
                            onLoginRequired={() => setCurrentView('login')} // Switch to login view if needed
                        />;
        }
    };

    return (
        <div className={styles.pageContainer}>
            <header className={styles.header}>
                 <div className={styles.headerTitle}>ChatGPT Reverse Account</div>
                 <nav className={styles.nav}>
                     <Button
                         variant="ghost"
                         onClick={() => setCurrentView('pricing')}
                         aria-current={currentView === 'pricing' ? 'page' : undefined}
                     >
                         Pricing
                     </Button>
                     {authState?.isLoggedIn ? (
                          <Button
                            variant="ghost"
                            onClick={() => setCurrentView('account')}
                            aria-current={currentView === 'account' ? 'page' : undefined}
                          >
                             Account
                          </Button>
                     ) : (
                         <Button
                            variant="ghost"
                            onClick={() => setCurrentView('login')}
                            aria-current={currentView === 'login' ? 'page' : undefined}
                         >
                             Login/Register
                         </Button>
                     )}
                 </nav>
            </header>
            <main className={styles.mainContent}>
                {renderContent()}
            </main>
        </div>
    );
}

export default AuthPage;
