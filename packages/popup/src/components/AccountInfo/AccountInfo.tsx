// packages/popup/src/components/AccountInfo/AccountInfo.tsx
import React from "react";
import Button from "../Button/Button";
import styles from "./AccountInfo.module.css";

interface AccountInfoProps {
    email: string | null;
    planId: string | null; // e.g., 'free', 'monthly', 'lifetime'
    onLogout: () => void;
    isLoading: boolean; // To disable logout during action
}

const AccountInfo: React.FC<AccountInfoProps> = ({
    email,
    planId,
    onLogout,
    isLoading,
}) => {
    const getPlanName = (id: string | null): string => {
        if (id === "monthly") return "Pro Monthly";
        if (id === "lifetime") return "Lifetime Pro";
        return "Free";
    };

    return (
        <div className={styles.accountContainer}>
            <h2 className={styles.title}>Account Status</h2>
            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Email:</span>
                <span className={styles.infoValue}>{email || "N/A"}</span>
            </div>
            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Plan:</span>
                <span className={styles.infoValue}>{getPlanName(planId)}</span>
            </div>

            {/* TODO: Add button to manage subscription if needed (link to Stripe portal?) */}
            {/* <Button variant="secondary" size="normal" className={styles.manageButton}>Manage Subscription</Button> */}

            <Button
                variant="secondary" // Use secondary style for logout
                size="normal"
                onClick={onLogout}
                disabled={isLoading}
                className={styles.logoutButton}
            >
                Logout
            </Button>
        </div>
    );
};

export default AccountInfo;
