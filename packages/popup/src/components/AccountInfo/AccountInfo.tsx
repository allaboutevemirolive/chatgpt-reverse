import React from 'react';
import Button from '../Button/Button';
import styles from './AccountInfo.module.css';

interface AccountInfoProps {
    email: string | null;
    planId: 'free' | 'monthly' | 'lifetime' | null; // Use specific types
    onLogout: () => void;
    isLoading: boolean; // To disable buttons during action
    // Add optional handler for managing subscription
    onManageSubscription?: () => void;
}

const AccountInfo: React.FC<AccountInfoProps> = ({
    email,
    planId,
    onLogout,
    isLoading,
    onManageSubscription, // Receive the handler
}) => {
    // Map plan IDs to display names
    const getPlanName = (id: AccountInfoProps['planId']): string => {
        switch (id) {
            case 'monthly':
                return 'Pro Monthly';
            case 'lifetime':
                return 'Lifetime Pro';
            case 'free':
            default:
                return 'Free';
        }
    };

    const currentPlanName = getPlanName(planId);
    const isPaidPlan = planId === 'monthly' || planId === 'lifetime';

    return (
        <div className={styles.accountContainer}>
            {/* Title */}
            <h2 className={styles.title}>Account Information</h2>

            {/* Email Info */}
            <div className={styles.infoGroup}>
                <span className={styles.infoLabel}>Email Address</span>
                <span className={styles.infoValue}>{email || 'N/A'}</span>
            </div>

            {/* Plan Info */}
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
                        variant="secondary" // Use secondary for non-primary actions
                        size="normal"
                        onClick={onManageSubscription}
                        disabled={isLoading}
                        className={styles.manageButton}
                    >
                        Manage Subscription
                    </Button>
                )}

                {/* Logout Button */}
                <Button
                    variant="ghost" // Use ghost for less emphasis, or 'outline'
                    size="normal"
                    onClick={onLogout}
                    disabled={isLoading}
                    className={styles.logoutButton} // Specific class for subtle danger hover
                >
                    Logout
                </Button>
            </div>
        </div>
    );
};

export default AccountInfo;
