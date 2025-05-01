// packages/popup/src/components/PricingSection/PricingSection.tsx
import React from 'react';
import PricingCard from '../PricingCard/PricingCard'; // Adjust path
import styles from './PricingSection.module.css';

// Define types for plan data and user status
interface PlanData {
    id: string; // e.g., 'free', 'monthly', 'lifetime'
    planName: string;
    price: string;
    frequency?: string;
    description: string;
    features: string[];
    buttonText: string;
    buttonVariant?: 'primary' | 'secondary' | 'outline';
    isFeatured?: boolean;
    storeLink?: string; // Optional link for the free plan
}

interface UserSubscription {
    planId: string | null; // ID of the current plan, or null if free/none
    // Add other relevant fields like expiry if needed
}

interface PricingSectionProps {
    userSubscription: UserSubscription | null;
    isLoggedIn: boolean;
    onSelectPlan: (planId: string) => void; // Callback when a paid plan button is clicked
    onLoginRequired: () => void; // Callback if login is needed to purchase
}

const PricingSection: React.FC<PricingSectionProps> = ({
    userSubscription,
    isLoggedIn,
    onSelectPlan,
    onLoginRequired
}) => {

    // --- Define Pricing Plans ---
    const pricingPlans: PlanData[] = [
        {
            id: 'free',
            planName: 'Free',
            price: '$0',
            frequency: '',
            description: 'Essential tools to get started.',
            features: [
                'Basic Audio Capture (AAC)',
                'Standard Export (MD)',
                'Basic Conversation Management',
                'Community Support',
            ],
            buttonText: 'Your Current Plan', // Changed text
            buttonVariant: 'secondary',
            isFeatured: false,
            storeLink: 'https://chromewebstore.google.com/detail/chatgpt-reverse/flcfhjdkcdnijdkcglnpecjkndnjjkai', // Example store link
        },
        {
            id: 'monthly',
            planName: 'Pro Monthly',
            price: '$1',
            frequency: '/ month',
            description: 'Unlock all features with flexibility.',
            features: [
                'Everything in Free, plus:',
                'Enhanced Audio Modes (MP3, Opus, FLAC)',
                'Bulk Export Options (Future)',
                'Advanced Conversation Filtering',
                'Priority Email Support',
                'Full API Experimentation Access',
            ],
            buttonText: 'Go Pro Monthly',
            buttonVariant: 'primary',
            isFeatured: false,
        },
        {
            id: 'lifetime',
            planName: 'Lifetime Deal',
            price: '$9.99',
            frequency: 'One-time',
            description: 'Get lifetime access with a single payment.',
            features: [
                'Everything in Pro Monthly',
                'Lifetime Updates Included',
                'Early Access to Beta Features',
                'One-Time Payment, Forever Access',
            ],
            buttonText: 'Get Lifetime Access',
            buttonVariant: 'primary',
            isFeatured: true,
        },
    ];

    const handleButtonClick = (plan: PlanData) => {
        if (plan.id === 'free') {
            // Optionally open store link if provided
            if (plan.storeLink) window.open(plan.storeLink, '_blank');
        } else {
            // Paid plan clicked
            if (isLoggedIn) {
                onSelectPlan(plan.id); // Trigger payment flow via parent
            } else {
                onLoginRequired(); // Tell parent login is needed
            }
        }
    };

    return (
        <section id="pricing" className={styles.pricingSection}>
            <h2 className={styles.sectionTitle}>Simple, Transparent Pricing</h2>
            <p className={styles.sectionSubtitle}>
                Choose the plan that fits your needs. Pay once for lifetime access or subscribe monthly.
            </p>
            <div className={styles.pricingGrid}>
                {pricingPlans.map((plan) => {
                    const isCurrent = userSubscription?.planId === plan.id || (plan.id === 'free' && !userSubscription?.planId);
                    return (
                        <PricingCard
                            key={plan.id}
                            {...plan}
                            isCurrentPlan={isCurrent}
                            buttonHref={plan.id === 'free' && plan.storeLink ? plan.storeLink : undefined}
                            buttonOnClick={plan.id !== 'free' ? () => handleButtonClick(plan) : undefined} // Only add click handler for paid plans here
                        />
                    );
                })}
            </div>
            <p className={styles.priceDisclaimer}>* Prices are in USD. One-time payment for Lifetime Deal.</p>
        </section>
    );
};

export default PricingSection;
