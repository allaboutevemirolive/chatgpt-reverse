// packages/popup/src/AuthPage.tsx
import React, { useState, useEffect } from "react";
import styles from './AuthPage.module.css';

function AuthPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoginView, setIsLoginView] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        setError(null);
        setSuccessMessage(null);
    }, [isLoginView]);

    const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(event.target.value);
        setError(null);
        setSuccessMessage(null);
    };

    const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(event.target.value);
        setError(null);
        setSuccessMessage(null);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!email || !password) {
            setError("Please enter both email and password.");
            return;
        }
        if (isLoading) return;

        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        const messageType = isLoginView ? "LOGIN_USER" : "REGISTER_USER";

        try {
            console.log(`AuthPage: Sending ${messageType} message...`);
            const response = await chrome.runtime.sendMessage({
                type: messageType,
                payload: { email, password },
            });
            console.log(`AuthPage: Received response for ${messageType}:`, response);

            if (response?.success) {
                const action = isLoginView ? "Logged in" : "Registered";
                setSuccessMessage(`${action} successfully! Welcome, ${response.data?.email || 'user'}. This page will close shortly.`);
                setTimeout(() => {
                    chrome.tabs.getCurrent(tab => {
                        if (tab?.id) {
                            chrome.tabs.remove(tab.id).catch(err => console.error("Error closing tab:", err));
                        }
                    });
                }, 2000); // Increased delay slightly
            } else {
                setError(response?.error?.message || `An unknown error occurred during ${isLoginView ? 'login' : 'registration'}.`);
            }
        } catch (err: any) {
            console.error(`AuthPage: Error sending ${messageType} message:`, err);
            setError(err.message || "Failed to communicate with the extension background.");
        } finally {
            setIsLoading(false);
        }
    };

    const toggleView = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        setIsLoginView(!isLoginView);
    };

    return (
        <div className={styles.container}>
            <form className={styles.form} onSubmit={handleSubmit}>
                <h1 className={styles.title}>
                    {isLoginView ? "Account Login" : "Create Account"}
                </h1>

                <div className={styles.inputGroup}>
                    <label htmlFor="email" className={styles.label}>Email Address</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={handleEmailChange}
                        required
                        className={styles.input}
                        placeholder="you@example.com"
                        disabled={isLoading}
                    />
                </div>

                <div className={styles.inputGroup}>
                    <label htmlFor="password" className={styles.label}>Password</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={handlePasswordChange}
                        required
                        minLength={6}
                        className={styles.input}
                        placeholder="••••••••"
                        disabled={isLoading}
                    />
                </div>

                <button
                    type="submit"
                    className={styles.button}
                    disabled={isLoading}
                >
                    {isLoading && <div className={styles.spinner}></div>}
                    <span>{isLoginView ? "Login" : "Register"}</span>
                </button>

                <button
                    type="button"
                    className={styles.toggleButton}
                    onClick={toggleView}
                    disabled={isLoading}
                >
                    {isLoginView ? "Need an account? Register" : "Already have an account? Login"}
                </button>
            </form>

            {/* Feedback Messages Below Form */}
            {error && <div className={styles.errorMessage}>{error}</div>}
            {successMessage && <div className={styles.successMessage}>{successMessage}</div>}
        </div>
    );
}

export default AuthPage;
