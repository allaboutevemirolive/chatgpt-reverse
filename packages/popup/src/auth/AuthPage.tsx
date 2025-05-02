// packages/popup/src/auth/AuthPage.tsx
import styles from "./AuthPage.module.css";
import { useAuthPageLogic } from "./useAuthPageLogic";

import Header from "./Header";
import PricingSection from "../components/PricingSection/PricingSection";
import LoginForm from "../components/LoginForm/LoginForm";
import AccountInfo from "../components/AccountInfo/AccountInfo";
import Button from "../components/Button/Button";

function AuthPage() {
    const {
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
    } = useAuthPageLogic();

    // --- Render Content Logic ---
    const renderMainContent = () => {
        // Combine all loading states for simplicity in disabling UI elements
        const combinedLoading =
            isLoading || isCheckoutLoading !== null || isPortalLoading;

        // Show loading indicator if any primary loading is happening (and no error)
        if (combinedLoading && !error) {
            let loadingText = "Loading Account...";
            if (isCheckoutLoading) loadingText = "Processing Checkout...";
            if (isPortalLoading) loadingText = "Loading Billing Portal...";
            return <div className={styles.loading}>{loadingText}</div>;
        }

        // Show critical errors first (unless it's a handled checkout cancel message)
        const criticalError =
            error && !error.includes("Checkout process was cancelled")
                ? error
                : null;
        if (criticalError) {
            return (
                <div className={styles.container}>
                    <p className={styles.criticalError}>Error: {criticalError}</p>
                    {!authState?.isLoggedIn && (
                        <Button
                            onClick={() => {
                                setError(null);
                                setCurrentView("login");
                            }}
                        >
                            Retry Login
                        </Button>
                    )}
                    {authState?.isLoggedIn && (
                        // General refresh might help resolve temporary issues
                        <Button onClick={() => window.location.reload()}>
                            Refresh Page
                        </Button>
                    )}
                </div>
            );
        }
        // Show checkout cancel error specifically if needed in relevant views
        const checkoutCancelError = error?.includes(
            "Checkout process was cancelled",
        )
            ? error
            : null;

        // Render view based on state
        switch (currentView) {
            case "login":
                return (
                    <div className={styles.container}>
                        <LoginForm onSuccess={handleLoginSuccess} />
                    </div>
                );

            case "account":
                // Ensure user is actually logged in before rendering account info
                if (!authState?.isLoggedIn) {
                    console.warn(
                        "AuthPage: Attempted account view while not logged in. Redirecting...",
                    );
                    setCurrentView("pricing"); // Use the setter from the hook
                    return <div className={styles.loading}>Redirecting...</div>; // Placeholder while redirecting
                }
                return (
                    <div className={styles.container}>
                        {/* Show checkout cancel error above account info if present */}
                        {checkoutCancelError && (
                            <p className={styles.criticalError}>{checkoutCancelError}</p>
                        )}
                        <AccountInfo
                            email={authState.email}
                            planId={subscription?.planId ?? null} // Default to null if sub not loaded
                            onLogout={handleLogout}
                            isLoading={combinedLoading} // Pass combined loading state
                            onManageSubscription={handleManageSubscription} // Pass the manage handler
                            isPortalLoading={isPortalLoading} // Pass portal specific loading state
                        />
                        {/* Button to navigate back to pricing */}
                        <Button
                            variant="ghost"
                            onClick={() => setCurrentView("pricing")}
                            disabled={combinedLoading} // Disable if anything is loading
                            style={{ marginTop: "var(--space-md)" }} // Add some top margin
                        >
                            View Pricing Plans
                        </Button>
                    </div>
                );

            case "pricing":
            default:
                return (
                    <>
                        {/* Show checkout cancel error above pricing if present */}
                        {checkoutCancelError && (
                            <p className={styles.criticalError}>{checkoutCancelError}</p>
                        )}
                        <PricingSection
                            // Pass the fetched subscription, provide a default if null
                            userSubscription={subscription ?? { planId: null }}
                            isLoggedIn={authState?.isLoggedIn ?? false}
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

    // Determine header button states based on hook values
    const showAccountButton = authState?.isLoggedIn ?? false;
    const isHeaderLoading = isLoading || isCheckoutLoading !== null || isPortalLoading;

    return (
        <div className={styles.pageContainer}>
            <Header
                currentView={currentView}
                showAccountButton={showAccountButton}
                isLoading={isHeaderLoading} // Pass combined loading state
                onNavigate={setCurrentView} // Pass state setter for navigation
            />
            <main className={styles.mainContent}>{renderMainContent()}</main>
        </div>
    );
}

export default AuthPage;
