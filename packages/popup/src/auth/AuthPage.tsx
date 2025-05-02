// src/auth/AuthPage.tsx
import styles from "./AuthPage.module.css";
import { useAuthPageLogic } from "./useAuthPageLogic";

// Import Components
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
        handleLoginSuccess,
        handleLogout,
        handleSelectPlan,
        setCurrentView,
        setError,
    } = useAuthPageLogic();

    // --- Render Content Logic --- (Remains the same as before)
    const renderMainContent = () => {
        // ... (keep the existing logic for rendering main content)
        if (isLoading || authState === null) {
            return <div className={styles.loading}>Loading Account...</div>;
        }
        if (isCheckoutLoading) {
            return <div className={styles.loading}>Processing Checkout...</div>;
        }
        const criticalError = (error && !error.includes("Checkout process was cancelled")) ? error : null;
        if (criticalError) {
            return (
                <div className={styles.container}>
                    <p className={styles.criticalError}>Error: {criticalError}</p>
                    {!authState.isLoggedIn && (
                        <Button onClick={() => { setError(null); setCurrentView("login"); }}>
                            Retry Login
                        </Button>
                    )}
                    {authState.isLoggedIn && (
                        <Button onClick={() => window.location.reload()}>
                            Refresh Page
                        </Button>
                    )}
                </div>
            );
        }
        const checkoutCancelError = error?.includes("Checkout process was cancelled") ? error : null;

        switch (currentView) {
            case "login":
                return (
                    <div className={styles.container}>
                        <LoginForm onSuccess={handleLoginSuccess} />
                    </div>
                );
            case "account":
                if (!authState.isLoggedIn) {
                    console.warn("AuthPage: Attempted to render account view while not logged in. Redirecting...");
                    setCurrentView("pricing");
                    return <div className={styles.loading}>Redirecting...</div>;
                }
                return (
                    <div className={styles.container}>
                        {checkoutCancelError && (<p className={styles.criticalError}>{checkoutCancelError}</p>)}
                        <AccountInfo
                            email={authState.email}
                            planId={subscription?.planId ?? null}
                            onLogout={handleLogout}
                            isLoading={isLoading || isCheckoutLoading !== null}
                        />
                        <Button
                            variant="ghost"
                            onClick={() => setCurrentView("pricing")}
                            disabled={isLoading || isCheckoutLoading !== null}
                            style={{ marginTop: "var(--space-md)" }}
                        >
                            View Pricing Plans
                        </Button>
                    </div>
                );
            case "pricing":
            default:
                return (
                    <>
                        {checkoutCancelError && <p className={styles.criticalError}>{checkoutCancelError}</p>}
                        <PricingSection
                            userSubscription={subscription ?? { planId: null }}
                            isLoggedIn={authState?.isLoggedIn ?? false}
                            isLoadingCheckout={isCheckoutLoading}
                            onSelectPlan={handleSelectPlan}
                            onLoginRequired={() => {
                                setError(null);
                                setCurrentView("login");
                            }}
                        />
                    </>
                );
        }
    };

    // Determine if Account button should show
    const showAccountButton = authState?.isLoggedIn ?? false;
    // Combine loading states for the header disable logic
    const isHeaderLoading = isLoading || isCheckoutLoading !== null;

    return (
        <div className={styles.pageContainer}>
            <Header
                currentView={currentView}
                showAccountButton={showAccountButton}
                isLoading={isHeaderLoading} // Pass combined loading state
                onNavigate={setCurrentView}  // Pass the navigation function
            />

            {/* Main content area uses the simplified render function */}
            <main className={styles.mainContent}>
                {renderMainContent()}
            </main>
        </div>
    );
}

export default AuthPage;
