// packages/popup/src/components/PricingCard/PricingCard.tsx
import React from "react";
import Button from "../Button/Button"; // Adjust path if necessary
import styles from "./PricingCard.module.css";
// If you want to use react-icons, add it: pnpm add react-icons -w
// import { FaCheckCircle } from 'react-icons/fa';

interface PricingCardProps {
    planName: string;
    price: string;
    frequency?: string;
    description: string;
    features: string[];
    buttonText: string;
    buttonOnClick?: () => void; // Use onClick handler instead of link for extension actions
    buttonHref?: string; // Optional href for external links (like store)
    buttonVariant?: "primary" | "secondary" | "outline";
    isDisabled?: boolean; // To disable button (e.g., if already subscribed)
    isFeatured?: boolean;
    isCurrentPlan?: boolean; // To indicate this is the user's current plan
}

const PricingCard: React.FC<PricingCardProps> = ({
    planName,
    price,
    frequency = "",
    description,
    features,
    buttonText,
    buttonOnClick,
    buttonHref,
    buttonVariant = "primary",
    isDisabled = false,
    isFeatured = false,
    isCurrentPlan = false,
}) => {
    const cardClasses = [
        styles.pricingCard,
        isFeatured ? styles.featured : "",
        isCurrentPlan ? styles.currentPlan : "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={cardClasses}>
            {isFeatured && (
                <div className={styles.featuredBadge}>Best Value</div>
            )}
            {isCurrentPlan && (
                <div className={styles.currentPlanBadge}>Current Plan</div>
            )}
            <h3 className={styles.planName}>{planName}</h3>
            <div className={styles.planPrice}>
                {price}
                {frequency && (
                    <span className={styles.priceFrequency}>{frequency}</span>
                )}
            </div>
            <p className={styles.planDescription}>{description}</p>
            <ul className={styles.planFeatures}>
                {features.map((feature, index) => (
                    <li key={index}>
                        {/* Basic Checkmark SVG - replace with react-icons if preferred */}
                        <svg
                            className={styles.featureCheckIcon}
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            width="18"
                            height="18"
                            aria-hidden="true"
                        >
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>
            <Button
                href={buttonHref}
                onClick={buttonOnClick}
                variant={isCurrentPlan ? "secondary" : buttonVariant}
                className={styles.planButton}
                // Pass the isDisabled prop to the Button component
                disabled={isDisabled || isCurrentPlan}
                target={buttonHref ? "_blank" : undefined}
                rel={buttonHref ? "noopener noreferrer" : undefined}
            >
                {/* Show dynamic text based on state */}
                {isCurrentPlan ? "Your Plan" : buttonText}
            </Button>
        </div>
    );
};

export default PricingCard;
