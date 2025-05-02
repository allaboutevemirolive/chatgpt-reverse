// src/auth/useAuthPageLogic.ts
import { useState, useEffect, useCallback } from "react";
import { sendMessageToSW } from "../utils/swMessenger";
import type {
    UserData,
    AuthState,
    UserSubscription,
    AuthPageView,
    CheckoutPlanId,
} from "./types"; // Import types

export function useAuthPageLogic() {
    // --- State ---
    const [authState, setAuthState] = useState<AuthState | null>(null);
    const [subscription, setSubscription] = useState<UserSubscription | null>(null);
    const [currentView, setCurrentView] = useState<AuthPageView>("pricing");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isCheckoutLoading, setIsCheckoutLoading] = useState<CheckoutPlanId | null>(null);

    // --- Effects ---
    useEffect(() => {
        let isMounted = true;
        console.log("AuthPage Logic: Mounting and fetching initial state...");

        // Handle Checkout Redirects
        const urlParams = new URLSearchParams(window.location.search);
        const checkoutStatus = urlParams.get("checkout");
        const sessionId = urlParams.get("session_id");

        if (checkoutStatus === "success") {
            console.log(
                "AuthPage Logic: Detected checkout success.",
                sessionId ? `Session ID: ${sessionId}` : "",
            );
            setError(null); // Clear previous errors
        } else if (checkoutStatus === "cancel") {
            console.log("AuthPage Logic: Detected checkout cancel.");
            setError("Checkout process was cancelled or failed. Please try again.");
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

            let initialAuthState: AuthState = { isLoggedIn: false, uid: null, email: null };
            let initialSubscription: UserSubscription | null = null;
            let initialView: AuthPageView = "pricing";

            try {
                const userAuthData = await sendMessageToSW<UserData | null>({ type: "GET_AUTH_STATE" });
                if (!isMounted) return;

                initialAuthState = userAuthData
                    ? { isLoggedIn: true, ...userAuthData }
                    : { isLoggedIn: false, uid: null, email: null };
                setAuthState(initialAuthState); // Update state

                if (initialAuthState.isLoggedIn && initialAuthState.uid) {
                    initialView = "account"; // Assume account if logged in
                    try {
                        const subData = await sendMessageToSW<{ planId: string | null; status: string | null } | null>({ type: "GET_SUBSCRIPTION_STATUS" });
                        if (!isMounted) return;

                        const validPlanId = (subData?.planId === "monthly" || subData?.planId === "lifetime") ? subData.planId : "free";
                        initialSubscription = subData ? { planId: validPlanId, status: subData.status } : { planId: "free", status: null };
                        setSubscription(initialSubscription); // Update state
                    } catch (subError: any) {
                        if (!isMounted) return;
                        console.error("AuthPage Logic: Failed to fetch subscription:", subError);
                        setError("Could not load subscription details.");
                        setSubscription({ planId: null, status: null }); // Reset on error
                    }
                } else {
                    initialView = "pricing"; // Default to pricing if not logged in
                    if (isMounted) setSubscription(null);
                }

                // Determine Final View (consider checkout status override)
                if (isMounted) {
                    if (checkoutStatus === "success" && initialAuthState.isLoggedIn) {
                        setCurrentView("account");
                    } else if (checkoutStatus === "cancel") {
                        setCurrentView("pricing");
                    } else {
                        setCurrentView(initialView);
                    }
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
                    console.log("AuthPage Logic: Initial data fetch complete. Final View:", currentView); // Log final view state
                }
            }
        };

        fetchInitialData();

        // SW Message Listener
        const messageListener = (message: any) => {
            if (!isMounted) return;
            console.log("AuthPage Logic: Received message from SW:", message?.type);

            if (message.type === "AUTH_STATE_UPDATED") {
                const newAuthState: AuthState = message.payload;
                const wasLoggedIn = authState?.isLoggedIn ?? false; // Use state from hook closure
                setAuthState(newAuthState);

                if (!newAuthState.isLoggedIn) {
                    setCurrentView("pricing");
                    setSubscription(null);
                    setError(null);
                    setIsLoading(false); // Make sure loading stops
                } else if (newAuthState.isLoggedIn && !wasLoggedIn) {
                    // Just logged in externally
                    setIsLoading(true); // Load sub
                    sendMessageToSW<{ planId: string | null; status: string | null } | null>({ type: "GET_SUBSCRIPTION_STATUS" })
                        .then((subData) => {
                            if (isMounted) {
                                const validPlanId = (subData?.planId === "monthly" || subData?.planId === "lifetime") ? subData.planId : "free";
                                setSubscription(subData ? { planId: validPlanId, status: subData.status } : { planId: "free", status: null });
                                setCurrentView("account");
                            }
                        })
                        .catch((err) => {
                            if (isMounted) {
                                console.error("AuthPage Logic: Error fetching sub after external login:", err);
                                setError("Failed to load subscription details after login update.");
                                setSubscription({ planId: null, status: null });
                                setCurrentView("account"); // Still show account page
                            }
                        })
                        .finally(() => {
                            if (isMounted) setIsLoading(false);
                        });
                } else if (newAuthState.isLoggedIn && currentView !== "account") {
                    // Ensure account view if already logged in but on wrong view
                    setCurrentView("account");
                }
            } else if (message.type === "SUBSCRIPTION_UPDATED") {
                console.log("AuthPage Logic: Subscription updated via broadcast", message.payload);
                const subPayload = message.payload;
                const validPlanId = (subPayload?.planId === "monthly" || subPayload?.planId === "lifetime") ? subPayload.planId : "free";
                setSubscription(subPayload ? { planId: validPlanId, status: subPayload.status } : { planId: "free", status: null });

                if (authState?.isLoggedIn && currentView !== "account") { // Check hook state
                    setCurrentView("account");
                }
                if (error?.includes("Checkout")) { // Check hook state
                    setError(null);
                }
            }
        };

        chrome.runtime.onMessage.addListener(messageListener);

        return () => {
            isMounted = false;
            chrome.runtime.onMessage.removeListener(messageListener);
            console.log("AuthPage Logic: Unmounted.");
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only on mount


    // --- Event Handlers (using useCallback for stable references) ---

    const handleLoginSuccess = useCallback((userData: UserData) => {
        console.log("AuthPage Logic: Login successful callback", userData);
        const newAuthState = { isLoggedIn: true, ...userData };
        setAuthState(newAuthState);
        setError(null);
        setIsLoading(true); // Load subscription

        const fetchSubAfterLogin = async () => {
            if (!userData.uid) {
                setError("Login succeeded but user ID is missing.");
                setIsLoading(false);
                setCurrentView("pricing");
                return;
            }
            try {
                await new Promise(resolve => setTimeout(resolve, 200)); // Short delay
                const subData = await sendMessageToSW<{ planId: string | null; status: string | null } | null>({ type: "GET_SUBSCRIPTION_STATUS" });
                const validPlanId = (subData?.planId === "monthly" || subData?.planId === "lifetime") ? subData.planId : "free";
                setSubscription(subData ? { planId: validPlanId, status: subData.status } : { planId: "free", status: null });
                setCurrentView("account");
            } catch (subError: any) {
                console.error("AuthPage Logic: Failed to fetch subscription after login:", subError);
                setError("Logged in, but failed to load subscription details.");
                setSubscription({ planId: null, status: null });
                setCurrentView("account"); // Still show account
            } finally {
                setIsLoading(false);
            }
        };
        fetchSubAfterLogin();
    }, []); // Empty dependency array as it doesn't depend on props/state outside the hook


    const handleLogout = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            await sendMessageToSW({ type: "LOGOUT_USER" });
            // Listener will update state/view
        } catch (err: any) {
            setError(err.message || "Logout failed.");
            setIsLoading(false); // Stop loading on error
        }
    }, []);


    const handleSelectPlan = useCallback(async (planId: CheckoutPlanId) => {
        // Read state directly from the hook's scope
        if (isCheckoutLoading || !authState?.isLoggedIn || isLoading) return;

        setError(null);
        setIsCheckoutLoading(planId);

        try {
            const checkoutUrl = await sendMessageToSW<string>({
                type: "CREATE_CHECKOUT_SESSION",
                payload: { planId: planId },
            });

            if (checkoutUrl && typeof checkoutUrl === "string" && checkoutUrl.startsWith("http")) {
                window.location.href = checkoutUrl; // Redirect
            } else {
                console.error("AuthPage Logic: Invalid checkout URL:", checkoutUrl);
                throw new Error("Failed to retrieve a valid checkout URL.");
            }
        } catch (err: any) {
            console.error(`AuthPage Logic: Error getting checkout URL for ${planId}:`, err);
            setError(err.message || "Could not initiate checkout.");
            setIsCheckoutLoading(null); // Reset loading on error
        }
    }, [authState, isLoading, isCheckoutLoading]); // Dependencies for the handler


    // Return state and handlers needed by the component
    return {
        authState,
        subscription,
        currentView,
        isLoading,
        error,
        isCheckoutLoading,
        handleLoginSuccess,
        handleLogout,
        handleSelectPlan,
        setCurrentView, // Expose setCurrentView for header buttons
        setError, // Expose setError for error recovery buttons
    };
}
