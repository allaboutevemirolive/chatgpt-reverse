// packages/popup/src/AuthPage.tsx
import { useState, useEffect } from "react";
import styles from "./AuthPage.module.css";
import { sendMessageToSW } from "../utils/swMessenger";
import PricingSection from "../components/PricingSection/PricingSection";
import LoginForm from "../components/LoginForm/LoginForm";
import AccountInfo from "../components/AccountInfo/AccountInfo";
import Button from "../components/Button/Button";

// --- Interfaces ---

interface UserData {
    uid: string;
    email: string | null;
}

interface AuthState {
    isLoggedIn: boolean;
    uid: string | null;
    email: string | null;
}

interface UserSubscription {
    // Adapt based on what getSubscriptionStatus returns and what PricingSection/AccountInfo need
    planId: "free" | "monthly" | "lifetime" | null;
    status?: string | null; // Optional: track stripe status ('active', 'canceled', etc.)
}

type AuthPageView = "pricing" | "login" | "account";

// --- Component ---

function AuthPage() {
    // --- State ---
    const [authState, setAuthState] = useState<AuthState | null>(null); // Start as null to indicate not yet loaded
    const [subscription, setSubscription] = useState<UserSubscription | null>(
        null,
    );
    const [currentView, setCurrentView] = useState<AuthPageView>("pricing"); // Default view
    const [isLoading, setIsLoading] = useState<boolean>(true); // Start loading
    const [error, setError] = useState<string | null>(null);
    const [isCheckoutLoading, setIsCheckoutLoading] = useState<
        "monthly" | "lifetime" | null
    >(null); // Track which plan checkout is loading

    // --- Effects ---

    useEffect(() => {
        let isMounted = true;
        console.log("AuthPage: Mounting and fetching initial state...");

        // Handle Checkout Redirects
        const urlParams = new URLSearchParams(window.location.search);
        const checkoutStatus = urlParams.get("checkout");
        const sessionId = urlParams.get("session_id"); // Optional: for debugging/logging

        if (checkoutStatus === "success") {
            console.log(
                "AuthPage: Detected checkout success from URL param.",
                sessionId ? `Session ID: ${sessionId}` : "",
            );
            // Clear potential previous errors, but don't set a specific success message here,
            // let the data fetch confirm the plan change.
            setError(null);
        } else if (checkoutStatus === "cancel") {
            console.log("AuthPage: Detected checkout cancel from URL param.");
            setError(
                "Checkout process was cancelled or failed. Please try again.",
            );
        }

        // Clean URL parameters after processing
        if (checkoutStatus && window.history.replaceState) {
            const cleanUrl = window.location.pathname;
            window.history.replaceState({ path: cleanUrl }, "", cleanUrl);
            console.log("AuthPage: Cleaned checkout status from URL.");
        }

        // --- Fetch Initial Auth and Subscription Data ---
        const fetchInitialData = async () => {
            if (!isMounted) return;
            console.log("AuthPage: fetchInitialData called.");
            setIsLoading(true);
            // Clear errors unless it's a specific cancel message we want to keep
            if (error && !error.includes("Checkout process was cancelled")) {
                 setError(null);
            }

            let currentAuthState: AuthState = {
                isLoggedIn: false,
                uid: null,
                email: null,
            };
            let fetchedSubscription: UserSubscription | null = null;
            let determinedView: AuthPageView = "pricing"; // Default view

            try {
                // 1. Fetch Auth State
                console.log("AuthPage: Sending GET_AUTH_STATE...");
                const userAuthData = await sendMessageToSW<UserData | null>({
                    type: "GET_AUTH_STATE",
                });
                if (!isMounted) return;

                currentAuthState = userAuthData
                    ? { isLoggedIn: true, ...userAuthData }
                    : { isLoggedIn: false, uid: null, email: null };
                setAuthState(currentAuthState); // Update auth state immediately
                console.log("AuthPage: Auth state received:", currentAuthState);

                // 2. Fetch Subscription Status *IF* logged in
                if (currentAuthState.isLoggedIn && currentAuthState.uid) {
                    determinedView = "account"; // Assume account view if logged in
                    try {
                        console.log(
                            "AuthPage: Fetching subscription status for UID:",
                            currentAuthState.uid,
                        );
                        const subData = await sendMessageToSW<{
                            planId: string | null;
                            status: string | null;
                        } | null>({ type: "GET_SUBSCRIPTION_STATUS" });

                        if (!isMounted) return;

                        // Update subscription state based on response
                        // Ensure planId fits the expected type
                        const validPlanId =
                            subData?.planId === "monthly" ||
                            subData?.planId === "lifetime"
                                ? subData.planId
                                : "free"; // Default invalid/null to free

                        fetchedSubscription = subData
                            ? { planId: validPlanId, status: subData.status }
                            : { planId: "free", status: null }; // Default to free if fetch fails
                        setSubscription(fetchedSubscription);
                        console.log(
                            "AuthPage: Subscription status received:",
                            fetchedSubscription,
                        );
                    } catch (subError: any) {
                        if (!isMounted) return;
                        console.error(
                            "AuthPage: Failed to fetch subscription status:",
                            subError,
                        );
                        setError(
                            "Could not load subscription details. Displaying account info without plan.",
                        );
                        setSubscription({ planId: null, status: null }); // Set to null plan on error
                        // Keep view as 'account' but potentially show error message later
                    }
                } else {
                    // Not logged in, default to pricing view
                    determinedView = "pricing";
                    if (isMounted) setSubscription(null); // Ensure subscription is null if not logged in
                }

                // 3. Determine Final View (consider checkout status override)
                if (isMounted) {
                    if (
                        checkoutStatus === "success" &&
                        currentAuthState.isLoggedIn
                    ) {
                        // If checkout succeeded, force account view
                        setCurrentView("account");
                    } else if (checkoutStatus === "cancel") {
                        // If checkout cancelled, force pricing view
                        setCurrentView("pricing");
                    } else {
                        // Otherwise, use the view determined by login status
                        setCurrentView(determinedView);
                    }
                }
            } catch (authError: any) {
                if (isMounted) {
                    setError(
                        authError.message || "Failed to load account status.",
                    );
                    // Reset everything on critical auth error
                    setAuthState({ isLoggedIn: false, uid: null, email: null });
                    setSubscription(null);
                    setCurrentView("pricing");
                }
                console.error(
                    "AuthPage: Error fetching initial auth data:",
                    authError,
                );
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                    console.log(
                        "AuthPage: Initial data fetch complete. Final View:",
                        currentView, // Log the view *after* potential overrides
                    );
                }
            }
        };

        fetchInitialData();

        // --- Service Worker Message Listener ---
        const messageListener = (message: any) => {
            if (!isMounted) return;
            console.log(
                "AuthPage: Received message from SW:",
                message?.type,
                message?.payload ?? "",
            );

            if (message.type === "AUTH_STATE_UPDATED") {
                const newAuthState: AuthState = message.payload;
                const wasLoggedIn = authState?.isLoggedIn ?? false;
                setAuthState(newAuthState);

                if (!newAuthState.isLoggedIn) {
                    console.log(
                        "AuthPage: Auth updated to logged out, switching view.",
                    );
                    setCurrentView("pricing");
                    setSubscription(null); // Clear subscription on logout
                    setError(null); // Clear errors on logout
                    setIsLoading(false); // Ensure loading stops
                } else if (newAuthState.isLoggedIn && !wasLoggedIn) {
                    // User just logged in (potentially from another tab)
                    console.log(
                        "AuthPage: Auth updated to logged in (externally), fetching subscription and switching view.",
                    );
                    setIsLoading(true); // Show loading while fetching sub
                    sendMessageToSW<{
                        planId: string | null;
                        status: string | null;
                    } | null>({ type: "GET_SUBSCRIPTION_STATUS" })
                        .then((subData) => {
                            if (isMounted) {
                                const validPlanId =
                                    subData?.planId === "monthly" ||
                                    subData?.planId === "lifetime"
                                        ? subData.planId
                                        : "free";
                                setSubscription(
                                    subData
                                        ? {
                                              planId: validPlanId,
                                              status: subData.status,
                                          }
                                        : { planId: "free", status: null },
                                );
                                setCurrentView("account"); // Switch to account view
                            }
                        })
                        .catch((err) => {
                            if (isMounted) {
                                console.error(
                                    "AuthPage: Error fetching sub after external login update:",
                                    err,
                                );
                                setError(
                                    "Failed to load subscription details after login update.",
                                );
                                setSubscription({ planId: null, status: null });
                                setCurrentView("account"); // Still show account page, but with error/no plan
                            }
                        })
                        .finally(() => {
                            if (isMounted) setIsLoading(false);
                        });
                } else if (newAuthState.isLoggedIn && currentView !== "account") {
                    // Already logged in, but perhaps on pricing/login view, switch to account
                    console.log(
                        "AuthPage: Auth update received while logged in, ensuring account view.",
                    );
                    setCurrentView("account");
                }
            } else if (message.type === "SUBSCRIPTION_UPDATED") {
                // Direct update from SW (e.g., after webhook processing)
                console.log(
                    "AuthPage: Subscription updated via broadcast",
                    message.payload,
                );
                const subPayload = message.payload;
                const validPlanId =
                    subPayload?.planId === "monthly" ||
                    subPayload?.planId === "lifetime"
                        ? subPayload.planId
                        : "free";
                setSubscription(
                    subPayload
                        ? { planId: validPlanId, status: subPayload.status }
                        : { planId: "free", status: null },
                );

                // If user is logged in, ensure view is 'account'
                if (authState?.isLoggedIn && currentView !== "account") {
                    setCurrentView("account");
                }
                // Clear checkout success/cancel errors if subscription updates definitively
                 if (error?.includes("Checkout")) {
                     setError(null);
                 }
            }
        };

        chrome.runtime.onMessage.addListener(messageListener);

        // --- Cleanup ---
        return () => {
            isMounted = false;
            chrome.runtime.onMessage.removeListener(messageListener);
            console.log("AuthPage: Unmounted.");
        };
    }, []); // Empty dependency array ensures this runs only once on mount

    // --- Event Handlers ---

    const handleLoginSuccess = (userData: UserData) => {
        console.log("AuthPage: Login/Register successful callback", userData);
        const newAuthState = { isLoggedIn: true, ...userData };
        setAuthState(newAuthState);
        setError(null); // Clear previous errors
        setIsLoading(true); // Start loading subscription

        const fetchSubAfterLogin = async () => {
            if (!userData.uid) {
                setError("Login succeeded but user ID is missing.");
                setIsLoading(false);
                setCurrentView("pricing"); // Fallback view
                return;
            }
            try {
                console.log(
                    "AuthPage: Fetching subscription status after login for UID:",
                    userData.uid,
                );
                // Add a small delay to allow potential backend updates to propagate if needed
                await new Promise((resolve) => setTimeout(resolve, 200));

                 const subData = await sendMessageToSW<{
                    planId: string | null;
                    status: string | null;
                 } | null>({ type: "GET_SUBSCRIPTION_STATUS" });

                 const validPlanId =
                     subData?.planId === "monthly" || subData?.planId === "lifetime"
                         ? subData.planId
                         : "free";

                 setSubscription(
                     subData
                         ? { planId: validPlanId, status: subData.status }
                         : { planId: "free", status: null }
                 );
                 setCurrentView("account"); // Go to account page
            } catch (subError: any) {
                console.error(
                    "AuthPage: Failed to fetch subscription after login:",
                    subError,
                );
                setError("Logged in, but failed to load subscription details.");
                setSubscription({ planId: null, status: null }); // Indicate unknown plan
                setCurrentView("account"); // Still go to account page
            } finally {
                setIsLoading(false); // Finish loading
            }
        };
        fetchSubAfterLogin();
    };

    const handleLogout = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await sendMessageToSW({ type: "LOGOUT_USER" });
            // The AUTH_STATE_UPDATED listener will handle resetting state and view
        } catch (err: any) {
            setError(err.message || "Logout failed.");
            setIsLoading(false); // Ensure loading stops on error
        }
        // No need to set state here, listener will do it
    };

    const handleSelectPlan = async (planId: "monthly" | "lifetime") => {
        if (isCheckoutLoading || !authState?.isLoggedIn || isLoading) return; // Prevent multiple clicks or clicks when not ready

        setError(null); // Clear previous errors
        setIsCheckoutLoading(planId); // Set loading specifically for this plan

        try {
            console.log(
                `AuthPage: Requesting checkout URL for plan ${planId}...`,
            );
            const checkoutUrl = await sendMessageToSW<string>({
                type: "CREATE_CHECKOUT_SESSION",
                payload: { planId: planId },
            });

            if (
                checkoutUrl &&
                typeof checkoutUrl === "string" &&
                checkoutUrl.startsWith("http")
            ) {
                console.log(
                    "AuthPage: Received valid checkout URL, redirecting...",
                    checkoutUrl,
                );
                window.location.href = checkoutUrl; // Redirect to Stripe
                // Don't need to reset isCheckoutLoading here, as the page navigates away
            } else {
                console.error(
                    "AuthPage: Received invalid checkout URL response:",
                    checkoutUrl,
                );
                throw new Error(
                    "Failed to retrieve a valid checkout URL. Please try again.",
                );
            }
        } catch (err: any) {
            console.error(
                `AuthPage: Error getting checkout URL for ${planId}:`,
                err,
            );
            setError(
                err.message || "Could not initiate checkout. Please try again.",
            );
            setIsCheckoutLoading(null); // Reset loading state on error
        }
        // No finally block needed here as we either redirect or handle error
    };

    // --- Render Logic ---

    const renderContent = () => {
        // Show initial loading state
        if (isLoading || authState === null) {
            return <div className={styles.loading}>Loading Account...</div>;
        }

        // Show checkout processing state (overrides other views)
        if (isCheckoutLoading) {
            return <div className={styles.loading}>Processing Checkout...</div>;
        }

        // Show critical errors (unless it's a handled checkout cancel message)
        if (error && !error.includes("Checkout process was cancelled")) {
            return (
                <div className={styles.container}>
                    <p className={styles.criticalError}>Error: {error}</p>
                    {/* Offer relevant recovery actions */}
                    {!authState.isLoggedIn && (
                        <Button
                            onClick={() => {
                                setError(null);
                                setCurrentView("login");
                            }}
                        >
                            Retry Login
                        </Button>
                    )}
                    {authState.isLoggedIn && (
                         // General refresh might help resolve temporary issues
                        <Button onClick={() => window.location.reload()}>
                            Refresh Page
                        </Button>
                    )}
                </div>
            );
        }

        // Render view based on state
        switch (currentView) {
            case "login":
                return (
                    <div className={styles.container}>
                        <LoginForm onSuccess={handleLoginSuccess} />
                    </div>
                );

            case "account":
                if (authState.isLoggedIn) {
                    // Show specific checkout cancel error here if needed
                    const accountError = error?.includes("Checkout process was cancelled") ? error : null;
                    return (
                        <div className={styles.container}>
                             {accountError && (<p className={styles.criticalError}>{accountError}</p>)}
                            <AccountInfo
                                email={authState.email}
                                // Pass the fetched subscription planId, default to null if not loaded
                                planId={subscription?.planId ?? null}
                                onLogout={handleLogout}
                                isLoading={isLoading || isCheckoutLoading !== null} // Disable logout during any loading
                            />
                            {/* Button to navigate back to pricing */}
                            <Button
                                variant="ghost"
                                onClick={() => setCurrentView("pricing")}
                                disabled={isLoading || isCheckoutLoading !== null}
                                style={{ marginTop: "var(--space-md)" }} // Add some top margin
                            >
                                View Pricing Plans
                            </Button>
                        </div>
                    );
                }
                // Fallback if somehow in 'account' view but not logged in
                console.warn(
                    "AuthPage: Attempted to render account view while not logged in. Switching to pricing.",
                );
                setCurrentView("pricing");
                return <div className={styles.loading}>Redirecting...</div>; // Placeholder

            case "pricing":
            default:
                // Show specific checkout cancel error here if needed
                 const pricingError = error?.includes("Checkout process was cancelled") ? error : null;
                return (
                    <>
                       {pricingError && <p className={styles.criticalError}>{pricingError}</p>}
                        <PricingSection
                            // Pass the fetched subscription, provide a default if null
                            userSubscription={subscription ?? { planId: null }}
                            isLoggedIn={authState.isLoggedIn}
                            isLoadingCheckout={isCheckoutLoading}
                            onSelectPlan={handleSelectPlan}
                            onLoginRequired={() => {
                                setError(null); // Clear errors before showing login
                                setCurrentView("login");
                            }}
                        />
                    </>
                );
        }
    };

    // Determine if the Account button should be shown in the header
    const showAccountButton = authState?.isLoggedIn ?? false;

    // --- JSX ---
    return (
        <div className={styles.pageContainer}>
            <header className={styles.header}>
                <div className={styles.headerTitle}>
                    ChatGPT Reverse Account
                </div>
                <nav className={styles.nav}>
                    {/* Pricing Button */}
                    <Button
                        variant="ghost"
                        onClick={() => !isLoading && !isCheckoutLoading && setCurrentView("pricing")}
                        disabled={isLoading || isCheckoutLoading !== null}
                        aria-current={currentView === "pricing" ? "page" : undefined}
                    >
                        Pricing
                    </Button>

                    {/* Conditional Account / Login Button */}
                    {showAccountButton ? (
                        <Button
                            variant="ghost"
                            onClick={() => !isLoading && !isCheckoutLoading && setCurrentView("account")}
                            disabled={isLoading || isCheckoutLoading !== null}
                            aria-current={currentView === "account" ? "page" : undefined}
                        >
                            Account
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            onClick={() => !isLoading && !isCheckoutLoading && setCurrentView("login")}
                            disabled={isLoading || isCheckoutLoading !== null}
                            aria-current={currentView === "login" ? "page" : undefined}
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
