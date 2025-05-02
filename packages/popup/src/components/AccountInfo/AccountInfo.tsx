// packages/popup/src/components/AccountInfo/AccountInfo.tsx
import React from "react";
import Button from "../Button/Button";
import styles from "./AccountInfo.module.css";

interface AccountInfoProps {
    email: string | null;
    planId: "free" | "monthly" | "lifetime" | null;
    onLogout: () => void;
    isLoading: boolean; // Combined loading state (auth, sub fetch, portal link)
    // Add handler prop for managing subscription
    onManageSubscription?: () => void;
    // Add specific loading state for the portal button
    isPortalLoading?: boolean;
}

const AccountInfo: React.FC<AccountInfoProps> = ({
    email,
    planId,
    onLogout,
    isLoading, // General loading
    onManageSubscription, // Receive the handler
    isPortalLoading, // Specific loading state for portal button
}) => {
    const getPlanName = (id: AccountInfoProps["planId"]): string => {
        switch (id) {
            case "monthly":
                return "Pro Monthly";
            case "lifetime":
                return "Lifetime Pro";
            case "free":
            default:
                return "Free";
        }
    };

    const currentPlanName = getPlanName(planId);
    // Determine if the user has a plan that can be managed in the portal
    // Usually, 'free' plans don't have anything to manage via Stripe Portal
    const isPaidPlan = planId === "monthly" || planId === "lifetime";

    return (
        <div className={styles.accountContainer}>
            <h2 className={styles.title}>Account Information</h2>

            <div className={styles.infoGroup}>
                <span className={styles.infoLabel}>Email Address</span>
                <span className={styles.infoValue}>{email || "N/A"}</span>
            </div>

            <div className={styles.infoGroup}>
                <span className={styles.infoLabel}>Current Plan</span>
                <span className={`${styles.infoValue} ${styles.planValue}`}>
                    {currentPlanName}
                </span>
            </div>

            {/* Buttons Area */}
            <div className={styles.buttonGroup}>
                {/* Conditionally render Manage Subscription Button */}
                {isPaidPlan && onManageSubscription && (
                    <Button
                        variant="secondary" // More appropriate than primary for management
                        size="normal"
                        onClick={onManageSubscription} // Call the passed handler
                        // Disable if general loading OR portal specifically loading
                        disabled={isLoading || isPortalLoading}
                        className={styles.manageButton}
                    >
                        {isPortalLoading
                            ? "Loading Portal..."
                            : "Manage Subscription"}
                    </Button>
                )}

                {/* Logout Button */}
                <Button
                    variant="ghost" // Use ghost for subtle logout
                    size="normal"
                    onClick={onLogout}
                    // Disable if general loading OR portal specifically loading
                    disabled={isLoading || isPortalLoading}
                    className={styles.logoutButton}
                >
                    Logout
                </Button>
            </div>
        </div>
    );
};

export default AccountInfo;
