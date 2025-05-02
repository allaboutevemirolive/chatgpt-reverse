// src/auth/Header.tsx
import React from "react";
// Remove direct import of Button component if we style directly
// import Button from '../components/Button/Button';
import styles from "./Header.module.css"; // Use Header's specific styles
import type { AuthPageView } from "./types";

interface HeaderProps {
    currentView: AuthPageView;
    showAccountButton: boolean;
    isLoading: boolean;
    onNavigate: (view: AuthPageView) => void;
}

const Header: React.FC<HeaderProps> = ({
    currentView,
    showAccountButton,
    isLoading,
    onNavigate,
}) => {
    // Helper function to get button classes
    const getButtonClasses = (view: AuthPageView): string => {
        const isActive = currentView === view;
        return `${styles.navButton} ${isActive ? styles.navButtonActive : ""}`;
    };

    return (
        <header className={styles.header}>
            <div className={styles.headerTitle}>ChatGPT Reverse Account</div>
            <nav className={styles.nav}>
                {/* Pricing Button - Use direct button element with custom classes */}
                <button
                    className={getButtonClasses("pricing")}
                    onClick={() => !isLoading && onNavigate("pricing")}
                    disabled={isLoading}
                    // aria-current={currentView === "pricing" ? "page" : undefined} // aria-current handled by class
                >
                    Pricing
                </button>

                {/* Conditional Account / Login Button */}
                {showAccountButton ? (
                    <button
                        className={getButtonClasses("account")}
                        onClick={() => !isLoading && onNavigate("account")}
                        disabled={isLoading}
                        // aria-current={currentView === "account" ? "page" : undefined}
                    >
                        Account
                    </button>
                ) : (
                    <button
                        className={getButtonClasses("login")}
                        onClick={() => !isLoading && onNavigate("login")}
                        disabled={isLoading}
                        // aria-current={currentView === "login" ? "page" : undefined}
                    >
                        Login/Register
                    </button>
                )}
            </nav>
        </header>
    );
};

export default Header;
