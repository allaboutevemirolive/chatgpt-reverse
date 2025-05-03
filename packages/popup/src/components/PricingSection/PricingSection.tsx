// packages/popup/src/components/PricingSection/PricingSection.tsx
import React from "react";
import PricingCard from "../PricingCard/PricingCard";
import styles from "./PricingSection.module.css";

interface PlanData {
    id: "free" | "monthly" | "lifetime";
    planName: string;
    price: string;
    frequency?: string;
    description: string;
    features: string[];
    buttonText: string;
    buttonVariant?: "primary" | "secondary" | "outline";
    isFeatured?: boolean;
    storeLink?: string;
}

interface UserSubscription {
    planId: PlanData["id"] | null;
}

interface PricingSectionProps {
    userSubscription: UserSubscription | null;
    isLoggedIn: boolean;
    isLoadingCheckout: PlanData["id"] | null;
    onSelectPlan: (planId: "monthly" | "lifetime") => void;
    onLoginRequired: () => void;
}

const PricingSection: React.FC<PricingSectionProps> = ({
    userSubscription,
    isLoggedIn,
    isLoadingCheckout,
    onSelectPlan,
    onLoginRequired,
}) => {

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
            buttonText: "Your Current Plan",
            buttonVariant: "secondary",
            isFeatured: false,

        },
        {
            id: "monthly",
            planName: "Pro Monthly",
            price: "$1",
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

        },
        {
            id: "lifetime",
            planName: "Lifetime Deal",
            price: "$9.99",
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
            isFeatured: true,

        },
    ];

    const handleButtonClick = (plan: PlanData) => {

        if (plan.id === "free") {

            if (plan.storeLink) {
                window.open(plan.storeLink, "_blank");
            }
            return;
        }

        if (plan.id === "monthly" || plan.id === "lifetime") {
            if (!isLoggedIn) {
                onLoginRequired();
            } else {

                onSelectPlan(plan.id);
            }
        }
    };

    return (
        <section id="pricing" className={styles.pricingSection}>
            <h2 className={styles.sectionTitle}>Simple, Transparent Pricing</h2>
            <p className={styles.sectionSubtitle}>
                Choose the plan that fits your needs. Upgrade anytime.
            </p>
            <div className={styles.pricingGrid}>
                {pricingPlans.map((plan) => {

                    const isCurrent =
                        plan.id === (userSubscription?.planId || "free");

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

                            isDisabled={isCurrent || isLoadingCheckout !== null}

                            buttonHref={
                                plan.id === "free" &&
                                    plan.storeLink &&
                                    !isCurrent
                                    ? plan.storeLink
                                    : undefined
                            }

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
