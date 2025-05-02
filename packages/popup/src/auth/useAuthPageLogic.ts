// packages/popup/src/auth/useAuthPageLogic.ts
import { useState, useEffect, useCallback } from "react";
import { sendMessageToSW } from "../utils/swMessenger";
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
            // Don't set view yet, wait for auth state
            didCheckoutOverrideView = true; // Mark that checkout status *might* override view
        } else if (checkoutStatus === "cancel") {
            console.log("AuthPage Logic: Detected checkout cancel.");
            setError(
                "Checkout process was cancelled or failed. Please try again.",
            );
            // Force pricing view on cancel
            if (isMounted) setCurrentView("pricing");
            didCheckoutOverrideView = true; // Mark that checkout status *did* override view
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
            // Start loading, clear errors unless it's a specific cancel message
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
                    type: "GET_AUTH_STATE",
                });
                if (!isMounted) return;

                initialAuthState = userAuthData
                    ? { isLoggedIn: true, ...userAuthData }
                    : { isLoggedIn: false, uid: null, email: null };
                setAuthState(initialAuthState); // Update state

                // 2. Fetch Subscription Status *IF* logged in
                if (initialAuthState.isLoggedIn && initialAuthState.uid) {
                    try {
                        const subData = await sendMessageToSW<{
                            planId: string | null;
                            status: string | null;
                        } | null>({ type: "GET_SUBSCRIPTION_STATUS" });
                        if (!isMounted) return;

                        const validPlanId =
                            subData?.planId === "monthly" ||
                                subData?.planId === "lifetime"
                                ? subData.planId
                                : "free";
                        initialSubscription = subData
                            ? { planId: validPlanId, status: subData.status }
                            : { planId: "free", status: null };
                        setSubscription(initialSubscription); // Update state
                    } catch (subError: any) {
                        if (!isMounted) return;
                        console.error(
                            "AuthPage Logic: Failed to fetch subscription:",
                            subError,
                        );
                        setError("Could not load subscription details.");
                        setSubscription({ planId: null, status: null });
                    }
                } else {
                    // Not logged in
                    if (isMounted) setSubscription(null);
                }

                // 3. Determine Final *Initial* View based on fetched data and checkout status
                if (isMounted) {
                    // Only set the view based on fetched data if checkout status didn't already dictate it
                    if (!didCheckoutOverrideView) {
                        if (initialAuthState.isLoggedIn) {
                            setCurrentView("account");
                        } else {
                            // Stays 'pricing' (initial state) if not logged in and no cancel redirect
                            setCurrentView("pricing");
                        }
                    } else if (
                        checkoutStatus === "success" &&
                        initialAuthState.isLoggedIn
                    ) {
                        // If checkout succeeded, ensure we end up on account page
                        setCurrentView("account");
                    }
                    // If checkout was cancelled, view was already set to 'pricing'
                }
            } catch (authError: any) {
                if (isMounted) {
                    setError(
                        authError.message || "Failed to load account status.",
                    );
                    setAuthState({ isLoggedIn: false, uid: null, email: null });
                    setSubscription(null);
                    setCurrentView("pricing"); // Reset view on critical error
                }
                console.error(
                    "AuthPage Logic: Error fetching initial auth data:",
                    authError,
                );
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                    // Log the final view state *after* all initial logic
                    console.log("AuthPage Logic: Initial data fetch complete.");
                }
            }
        };

        fetchInitialData();

        // SW Message Listener (Keep this as is, it handles updates *after* initial load)
        const messageListener = (message: any) => {
            if (!isMounted) return;
            console.log(
                "AuthPage Logic: Received message from SW:",
                message?.type,
            );

            if (message.type === "AUTH_STATE_UPDATED") {
                const newAuthState: AuthState = message.payload;
                // Use function form of setState to get previous state reliably
                setAuthState((prevState) => {
                    const wasLoggedIn = prevState?.isLoggedIn ?? false;
                    if (!newAuthState.isLoggedIn) {
                        setCurrentView("pricing");
                        setSubscription(null);
                        setError(null);
                        setIsLoading(false);
                    } else if (newAuthState.isLoggedIn && !wasLoggedIn) {
                        // Just logged in externally
                        setIsLoading(true);
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
                                    setCurrentView("account");
                                }
                            })
                            .catch((err) => {
                                if (isMounted) {
                                    console.error(
                                        "AuthPage Logic: Error fetching sub after external login:",
                                        err,
                                    );
                                    setError(
                                        "Failed to load subscription details after login update.",
                                    );
                                    setSubscription({
                                        planId: null,
                                        status: null,
                                    });
                                    setCurrentView("account");
                                }
                            })
                            .finally(() => {
                                if (isMounted) setIsLoading(false);
                            });
                    } else if (
                        newAuthState.isLoggedIn &&
                        currentView !== "account"
                    ) {
                        // Ensure account view if already logged in but on wrong view (e.g. manual refresh on pricing)
                        setCurrentView("account");
                    }
                    return newAuthState; // Return the new state for setAuthState
                });
            } else if (message.type === "SUBSCRIPTION_UPDATED") {
                console.log(
                    "AuthPage Logic: Subscription updated via broadcast",
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

                // Use functional update for safety if checking previous state
                setAuthState((prevAuthState) => {
                    if (
                        prevAuthState?.isLoggedIn &&
                        currentView !== "account"
                    ) {
                        setCurrentView("account");
                    }
                    return prevAuthState;
                });

                setError((prevError) =>
                    prevError?.includes("Checkout") ? null : prevError,
                );
            }
        };

        chrome.runtime.onMessage.addListener(messageListener);

        // Cleanup
        return () => {
            isMounted = false;
            chrome.runtime.onMessage.removeListener(messageListener);
            console.log("AuthPage Logic: Unmounted.");
        };
        // We intentionally keep the dependency array empty for the main setup effect.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- Event Handlers (Keep these useCallback versions) ---
    const handleLoginSuccess = useCallback((userData: UserData) => {
        console.log("AuthPage Logic: Login successful callback", userData);
        const newAuthState = { isLoggedIn: true, ...userData };
        setAuthState(newAuthState);
        setError(null);
        setIsLoading(true);

        const fetchSubAfterLogin = async () => {
            if (!userData.uid) {
                /* ... error handling ... */ return;
            }
            try {
                await new Promise((resolve) => setTimeout(resolve, 200));
                const subData = await sendMessageToSW<{
                    planId: string | null;
                    status: string | null;
                } | null>({ type: "GET_SUBSCRIPTION_STATUS" });
                const validPlanId =
                    subData?.planId === "monthly" ||
                        subData?.planId === "lifetime"
                        ? subData.planId
                        : "free";
                setSubscription(
                    subData
                        ? { planId: validPlanId, status: subData.status }
                        : { planId: "free", status: null },
                );
                setCurrentView("account");
            } catch (subError: any) {
                console.error(
                    "AuthPage Logic: Failed to fetch subscription after login:",
                    subError,
                );
                setError("Logged in, but failed to load subscription details.");
                setSubscription({ planId: null, status: null });
                setCurrentView("account");
            } finally {
                setIsLoading(false);
            }
        };
        fetchSubAfterLogin();
    }, []);

    const handleLogout = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            await sendMessageToSW({ type: "LOGOUT_USER" });
            // Listener will update state
        } catch (err: any) {
            setError(err.message || "Logout failed.");
            setIsLoading(false);
        }
    }, []);

    const handleSelectPlan = useCallback(
        async (planId: CheckoutPlanId) => {
            if (
                isCheckoutLoading ||
                !authState?.isLoggedIn ||
                isLoading ||
                isPortalLoading
            )
                return;
            setError(null);
            setIsCheckoutLoading(planId);
            try {
                const checkoutUrl = await sendMessageToSW<string>({
                    type: "CREATE_CHECKOUT_SESSION",
                    payload: { planId },
                });
                if (checkoutUrl?.startsWith("http")) {
                    window.location.href = checkoutUrl;
                } else {
                    throw new Error("Failed to retrieve a valid checkout URL.");
                }
            } catch (err: any) {
                console.error(
                    `AuthPage Logic: Error getting checkout URL for ${planId}:`,
                    err,
                );
                setError(err.message || "Could not initiate checkout.");
                setIsCheckoutLoading(null);
            }
        },
        [authState, isLoading, isCheckoutLoading, isPortalLoading],
    );

    const handleManageSubscription = useCallback(async () => {
        if (
            !authState?.isLoggedIn ||
            isLoading ||
            isCheckoutLoading ||
            isPortalLoading
        )
            return;
        setIsPortalLoading(true);
        setError(null);
        try {
            const portalUrl = await sendMessageToSW<string>({
                type: "CREATE_CUSTOMER_PORTAL_SESSION",
            });
            if (portalUrl?.startsWith("http")) {
                window.open(portalUrl, "_blank");
                await new Promise((resolve) => setTimeout(resolve, 100));
            } else {
                throw new Error("Failed to retrieve a valid portal URL.");
            }
        } catch (err: any) {
            console.error("AuthPage Logic: Error getting portal URL:", err);
            setError(err.message || "Could not open billing management page.");
        } finally {
            setIsPortalLoading(false);
        }
    }, [authState, isLoading, isCheckoutLoading, isPortalLoading]);

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
        setCurrentView, // Expose setCurrentView for header/buttons
        setError, // Expose setError for error recovery
    };
}
