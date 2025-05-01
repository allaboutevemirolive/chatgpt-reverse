// packages/popup/src/components/PricingSection/PricingSection.tsx
import React from "react";
import PricingCard from "../PricingCard/PricingCard"; // Adjust path if necessary
import styles from "./PricingSection.module.css";

// --- Type Definitions ---

// Describes the data structure for a single pricing plan
interface PlanData {
    id: "free" | "monthly" | "lifetime"; // Use specific IDs
    planName: string;
    price: string;
    frequency?: string;
    description: string;
    features: string[];
    buttonText: string;
    buttonVariant?: "primary" | "secondary" | "outline";
    isFeatured?: boolean;
    storeLink?: string; // Optional link only for the free plan button
    stripePriceId?: string; // Store the associated Stripe Price ID (used internally by SW)
}

// Describes the user's current subscription status (fetched from SW/backend)
interface UserSubscription {
    planId: PlanData["id"] | null; // Matches the PlanData id type
    // Add other relevant fields like expiry, status etc. from your subscription data
    // e.g., status?: 'active' | 'trialing' | 'canceled';
    // e.g., paidUntilTimestamp?: number;
}

// Props expected by the PricingSection component
interface PricingSectionProps {
    userSubscription: UserSubscription | null;
    isLoggedIn: boolean;
    isLoadingCheckout: PlanData['id'] | null;
    onSelectPlan: (planId: 'monthly' | 'lifetime') => void; // Correctly type the callback
    onLoginRequired: () => void;
}

// --- Component Implementation ---

const PricingSection: React.FC<PricingSectionProps> = ({
    userSubscription,
    isLoggedIn,
    isLoadingCheckout, // Receive the specific plan ID being loaded, or null
    onSelectPlan,
    onLoginRequired,
}) => {
    // --- Define Pricing Plans ---
    // Match the 'id' field with the `planId` you expect in the UserSubscription object
    // and the `planId` sent to the service worker for checkout.
    const pricingPlans: PlanData[] = [
        {
            id: "free",
            planName: "Free",
            price: "$0",
            frequency: "",
            description: "Essential tools to get started.",
            features: [
                "Basic Audio Capture (AAC)",
                "Standard Export (MD)",
                "Basic Conversation Management",
                "Community Support",
            ],
            buttonText: "Your Current Plan", // Text shown when this is the current plan
            buttonVariant: "secondary", // Use a less prominent style for the free plan button/indicator
            isFeatured: false,
            // storeLink: 'YOUR_CHROME_STORE_LINK', // Optional: Link to Chrome store page
        },
        {
            id: "monthly",
            planName: "Pro Monthly",
            price: "$1", // Ensure this matches your Stripe Product Price
            frequency: "/ month",
            description: "Unlock all features with flexibility.",
            features: [
                "Everything in Free, plus:",
                "Enhanced Audio Modes (MP3, Opus, FLAC)",
                "Bulk Export Options (Future)",
                "Advanced Conversation Filtering",
                "Priority Email Support",
                "Full API Experimentation Access",
            ],
            buttonText: "Go Pro Monthly",
            buttonVariant: "primary",
            isFeatured: false,
            stripePriceId: "price_1PV38iJGLYV9XQh12y88Qo3h", // Your actual Stripe Price ID
        },
        {
            id: "lifetime",
            planName: "Lifetime Deal",
            price: "$9.99", // Ensure this matches your Stripe Product Price
            frequency: "One-time",
            description: "Get lifetime access with a single payment.",
            features: [
                "Everything in Pro Monthly",
                "Lifetime Updates Included",
                "Early Access to Beta Features",
                "One-Time Payment, Forever Access",
            ],
            buttonText: "Get Lifetime Access",
            buttonVariant: "primary",
            isFeatured: true, // Make this stand out
            stripePriceId: "price_1PV38jJGLYV9XQh173aYJbQ5", // Your actual Stripe Price ID
        },
    ];

    // --- Button Click Handler ---
    const handleButtonClick = (plan: PlanData) => {
        // Don't handle clicks on the free plan button if it's just informational
        if (plan.id === "free") {
            // If you have a store link, open it
            if (plan.storeLink) {
                window.open(plan.storeLink, "_blank");
            }
            return; // Do nothing else for the free plan click
        }

        // Handle paid plans
        if (plan.id === "monthly" || plan.id === "lifetime") {
            if (!isLoggedIn) {
                onLoginRequired(); // Trigger login flow if not logged in
            } else {
                // User is logged in, trigger the checkout process
                onSelectPlan(plan.id);
            }
        }
    };

    // --- Render ---
    return (
        <section id="pricing" className={styles.pricingSection}>
            <h2 className={styles.sectionTitle}>Simple, Transparent Pricing</h2>
            <p className={styles.sectionSubtitle}>
                Choose the plan that fits your needs. Upgrade anytime.
            </p>
            <div className={styles.pricingGrid}>
                {pricingPlans.map((plan) => {
                    // Determine if this card represents the user's current plan
                    const isCurrent =
                        plan.id === (userSubscription?.planId || "free");
                    // Determine if this specific plan's checkout is loading
                    const isThisPlanLoading = isLoadingCheckout === plan.id;

                    return (
                        <PricingCard
                            key={plan.id}
                            planName={plan.planName}
                            price={plan.price}
                            frequency={plan.frequency}
                            description={plan.description}
                            features={plan.features}
                            buttonText={
                                isThisPlanLoading
                                    ? "Processing..."
                                    : plan.buttonText
                            }
                            buttonVariant={plan.buttonVariant}
                            isFeatured={plan.isFeatured}
                            isCurrentPlan={isCurrent}
                            // Disable the button if it's the current plan OR if *any* checkout is loading
                            isDisabled={isCurrent || isLoadingCheckout !== null}
                            // Only provide href for the free plan's store link
                            buttonHref={
                                plan.id === "free" &&
                                plan.storeLink &&
                                !isCurrent
                                    ? plan.storeLink
                                    : undefined
                            }
                            // Only provide onClick for plans that are NOT free and NOT the current plan
                            buttonOnClick={
                                plan.id !== "free" && !isCurrent
                                    ? () => handleButtonClick(plan)
                                    : undefined
                            }
                        />
                    );
                })}
            </div>
            <p className={styles.priceDisclaimer}>
                * Prices are in USD. Taxes may apply. One-time payment for
                Lifetime Deal.
            </p>
        </section>
    );
};

export default PricingSection;
