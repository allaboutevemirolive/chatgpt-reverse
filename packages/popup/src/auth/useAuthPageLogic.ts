// packages/popup/src/auth/useAuthPageLogic.ts
import { useState, useEffect, useCallback } from "react";
import { sendMessageToSW } from "../utils/swMessenger";
import { MSG } from "@shared";
import type {
    UserData,
    AuthState,
    UserSubscription,
    AuthPageView,
    CheckoutPlanId,
} from "./types";

export function useAuthPageLogic() {
    // --- State ---
    const [authState, setAuthState] = useState<AuthState | null>(null);
    const [subscription, setSubscription] = useState<UserSubscription | null>(
        null,
    );
    const [currentView, setCurrentView] = useState<AuthPageView>("pricing"); // Start with pricing
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isCheckoutLoading, setIsCheckoutLoading] =
        useState<CheckoutPlanId | null>(null);
    const [isPortalLoading, setIsPortalLoading] = useState<boolean>(false);

    // --- Effects ---
    useEffect(() => {
        let isMounted = true;
        console.log("AuthPage Logic: Mounting and fetching initial state...");

        // Handle Checkout Redirects
        const urlParams = new URLSearchParams(window.location.search);
        const checkoutStatus = urlParams.get("checkout");
        const sessionId = urlParams.get("session_id");

        let didCheckoutOverrideView = false; // Flag to see if checkout status determined the view

        if (checkoutStatus === "success") {
            console.log(
                "AuthPage Logic: Detected checkout success.",
                sessionId ? `Session ID: ${sessionId}` : "",
            );
            setError(null);
            didCheckoutOverrideView = true;
        } else if (checkoutStatus === "cancel") {
            console.log("AuthPage Logic: Detected checkout cancel.");
            setError(
                "Checkout process was cancelled or failed. Please try again.",
            );
            if (isMounted) setCurrentView("pricing");
            didCheckoutOverrideView = true;
        }

        // Clean URL parameters
        if (checkoutStatus && window.history.replaceState) {
            const cleanUrl = window.location.pathname;
            window.history.replaceState({ path: cleanUrl }, "", cleanUrl);
            console.log("AuthPage Logic: Cleaned checkout status from URL.");
        }

        // Fetch Initial Data
        const fetchInitialData = async () => {
            if (!isMounted) return;
            console.log("AuthPage Logic: fetchInitialData called.");
            setIsLoading(true);
            if (error && !error.includes("Checkout process was cancelled")) {
                setError(null);
            }

            let initialAuthState: AuthState = {
                isLoggedIn: false,
                uid: null,
                email: null,
            };
            let initialSubscription: UserSubscription | null = null;

            try {
                // 1. Fetch Auth State
                const userAuthData = await sendMessageToSW<UserData | null>({
                    type: MSG.GET_AUTH_STATE, // <-- Use constant
                });
                if (!isMounted) return;

                initialAuthState = userAuthData
                    ? { isLoggedIn: true, ...userAuthData }
                    : { isLoggedIn: false, uid: null, email: null };
                setAuthState(initialAuthState); // Update state

                // 2. Fetch Subscription Status *IF* logged in
                if (initialAuthState.isLoggedIn && initialAuthState.uid) {
                    try {
                        const subData = await sendMessageToSW<UserSubscription | null>({ // Adjusted type expectation
                            type: MSG.GET_SUBSCRIPTION_STATUS, // <-- Use constant
                        });
                        if (!isMounted) return;

                        // Validate planId before setting
                        const validPlanId =
                            subData?.planId === "monthly" ||
                                subData?.planId === "lifetime"
                                ? subData.planId
                                : "free";
                        initialSubscription = subData
                            ? { ...subData, planId: validPlanId } // Ensure validPlanId is set
                            : { planId: "free", status: null };
                        setSubscription(initialSubscription);
                    } catch (subError: any) {
                        if (!isMounted) return;
                        console.error("AuthPage Logic: Failed to fetch subscription:", subError);
                        // Distinguish between "not found" (implicitly free) and actual errors
                        if (subError.message?.includes('unauthenticated')) {
                            console.warn("AuthPage Logic: Subscription fetch failed due to unauthenticated state.");
                            setSubscription({ planId: "free", status: null }); // Assume free if unauthenticated error
                        } else {
                            setError("Could not load subscription details.");
                            setSubscription({ planId: null, status: null }); // Indicate error state
                        }
                    }
                } else {
                    // Not logged in
                    if (isMounted) setSubscription(null);
                }

                // 3. Determine Final *Initial* View
                if (isMounted) {
                    if (!didCheckoutOverrideView) {
                        if (initialAuthState.isLoggedIn) {
                            // User is logged in, default to account view
                            setCurrentView("account");
                        } else {
                            // Not logged in, no checkout status => pricing view
                            setCurrentView("pricing");
                        }
                    } else if (checkoutStatus === "success" && initialAuthState.isLoggedIn) {
                        // Checkout success and we confirmed login => account view
                        setCurrentView("account");
                    }
                    // Note: If checkoutStatus === 'cancel', view was already set to 'pricing'
                }

            } catch (authError: any) {
                if (isMounted) {
                    setError(authError.message || "Failed to load account status.");
                    setAuthState({ isLoggedIn: false, uid: null, email: null });
                    setSubscription(null);
                    setCurrentView("pricing"); // Reset view on critical error
                }
                console.error("AuthPage Logic: Error fetching initial auth data:", authError);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                    console.log("AuthPage Logic: Initial data fetch complete.");
                }
            }
        };

        fetchInitialData();

        // SW Message Listener
        const messageListener = (message: any) => {
            if (!isMounted) return;
            const messageType = message?.type; // Safe access
            console.log("AuthPage Logic: Received message from SW:", messageType);

            if (messageType === MSG.AUTH_STATE_UPDATED) { // <-- Use constant
                const newAuthState: AuthState = message.payload;
                setAuthState(prevState => {
                    const wasLoggedIn = prevState?.isLoggedIn ?? false;
                    const justLoggedIn = newAuthState.isLoggedIn && !wasLoggedIn;
                    const justLoggedOut = !newAuthState.isLoggedIn && wasLoggedIn;

                    if (justLoggedOut) {
                        setCurrentView("pricing");
                        setSubscription(null);
                        setError(null);
                        setIsLoading(false); // Stop loading on logout
                    } else if (justLoggedIn) {
                        // User just logged in externally, fetch their sub
                        setIsLoading(true); // Show loading while fetching sub
                        sendMessageToSW<UserSubscription | null>({ type: MSG.GET_SUBSCRIPTION_STATUS }) // <-- Use constant
                            .then((subData) => {
                                if (isMounted) {
                                    const validPlanId = (subData?.planId === "monthly" || subData?.planId === "lifetime") ? subData.planId : "free";
                                    setSubscription(subData ? { ...subData, planId: validPlanId } : { planId: "free", status: null });
                                    setCurrentView("account"); // Go to account after getting sub
                                }
                            })
                            .catch((err) => {
                                if (isMounted) {
                                    console.error("AuthPage Logic: Error fetching sub after external login:", err);
                                    setError("Failed to load subscription details after login update.");
                                    setSubscription({ planId: null, status: null });
                                    setCurrentView("account"); // Still go to account, but show error
                                }
                            })
                            .finally(() => {
                                if (isMounted) setIsLoading(false); // Stop loading after attempt
                            });
                    } else if (newAuthState.isLoggedIn && currentView !== "account") {
                        // Logged in, but maybe on pricing/login page (e.g., refresh) -> switch to account
                        setCurrentView("account");
                        // Potentially re-fetch subscription here if needed, or rely on initial fetch/broadcasts
                    }
                    return newAuthState; // Update the auth state
                });

            } else if (messageType === MSG.SUBSCRIPTION_UPDATED) { // <-- Use constant
                console.log("AuthPage Logic: Subscription updated via broadcast", message.payload);
                const subPayload: UserSubscription | null = message.payload;
                const validPlanId = (subPayload?.planId === "monthly" || subPayload?.planId === "lifetime") ? subPayload.planId : "free";
                setSubscription(subPayload ? { ...subPayload, planId: validPlanId } : { planId: "free", status: null });

                setAuthState(prevAuthState => {
                    if (prevAuthState?.isLoggedIn && currentView !== "account") {
                        setCurrentView("account"); // Ensure account view if sub updates while logged in
                    }
                    return prevAuthState;
                })
                // Clear any checkout-related errors upon subscription update
                setError(prevError => (prevError?.includes("Checkout") ? null : prevError));
            }
        };

        chrome.runtime.onMessage.addListener(messageListener);

        // Cleanup
        return () => {
            isMounted = false;
            chrome.runtime.onMessage.removeListener(messageListener);
            console.log("AuthPage Logic: Unmounted.");
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty dependency array ensures setup runs once

    // --- Event Handlers ---
    const handleLoginSuccess = useCallback((userData: UserData) => {
        console.log("AuthPage Logic: Login successful callback", userData);
        const newAuthState = { isLoggedIn: true, ...userData };
        setAuthState(newAuthState);
        setError(null);
        setIsLoading(true); // Start loading sub details

        const fetchSubAfterLogin = async () => {
            if (!userData.uid) {
                console.error("AuthPage Logic: Login success but no UID!");
                setError("Login error: Missing user identifier.");
                setIsLoading(false);
                return;
            }
            try {
                // Short delay might sometimes help Firestore replication, but often not needed
                // await new Promise(resolve => setTimeout(resolve, 200));
                const subData = await sendMessageToSW<UserSubscription | null>({
                    type: MSG.GET_SUBSCRIPTION_STATUS, // <-- Use constant
                });
                const validPlanId = (subData?.planId === "monthly" || subData?.planId === "lifetime") ? subData.planId : "free";
                setSubscription(subData ? { ...subData, planId: validPlanId } : { planId: "free", status: null });
                setCurrentView("account"); // Navigate to account page
            } catch (subError: any) {
                console.error("AuthPage Logic: Failed to fetch subscription after login:", subError);
                setError("Logged in, but failed to load subscription details.");
                setSubscription({ planId: null, status: null }); // Indicate error state
                setCurrentView("account"); // Still navigate, but error will show
            } finally {
                setIsLoading(false); // Stop loading after attempt
            }
        };
        fetchSubAfterLogin();
    }, []); // Empty dependency array is correct here

    const handleLogout = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            await sendMessageToSW({ type: MSG.LOGOUT_USER }); // <-- Use constant
            // Auth state listener will handle the rest (setting state, view, etc.)
        } catch (err: any) {
            setError(err.message || "Logout failed.");
            setIsLoading(false); // Stop loading only if logout action itself failed
        }
    }, []);

    const handleSelectPlan = useCallback(async (planId: CheckoutPlanId) => {
        if (isCheckoutLoading || !authState?.isLoggedIn || isLoading || isPortalLoading) return;
        setError(null);
        setIsCheckoutLoading(planId);
        try {
            const checkoutUrl = await sendMessageToSW<string>({
                type: MSG.CREATE_CHECKOUT_SESSION, // <-- Use constant
                payload: { planId }
            });
            if (checkoutUrl?.startsWith("http")) {
                window.location.href = checkoutUrl; // Redirect to Stripe
            } else {
                throw new Error("Failed to retrieve a valid checkout URL.");
            }
        } catch (err: any) {
            console.error(`AuthPage Logic: Error getting checkout URL for ${planId}:`, err);
            setError(err.message || "Could not initiate checkout.");
            setIsCheckoutLoading(null); // Stop loading on error
        }
    }, [authState, isLoading, isCheckoutLoading, isPortalLoading]);

    const handleManageSubscription = useCallback(async () => {
        if (!authState?.isLoggedIn || isLoading || isCheckoutLoading || isPortalLoading) return;
        setIsPortalLoading(true);
        setError(null);
        try {
            const portalUrl = await sendMessageToSW<string>({
                type: MSG.CREATE_CUSTOMER_PORTAL_SESSION // <-- Use constant
            });
            if (portalUrl?.startsWith("http")) {
                window.open(portalUrl, '_blank'); // Open portal in new tab
                // No need to wait after opening
            } else {
                throw new Error("Failed to retrieve a valid portal URL.");
            }
        } catch (err: any) {
            console.error("AuthPage Logic: Error getting portal URL:", err);
            setError(err.message || "Could not open billing management page.");
        } finally {
            setIsPortalLoading(false); // Stop loading regardless of outcome
        }
    }, [authState, isLoading, isCheckoutLoading, isPortalLoading]);


    // Return state and handlers
    return {
        authState,
        subscription,
        currentView,
        isLoading,
        error,
        isCheckoutLoading,
        isPortalLoading,
        handleLoginSuccess,
        handleLogout,
        handleSelectPlan,
        handleManageSubscription,
        setCurrentView,
        setError,
    };
}
