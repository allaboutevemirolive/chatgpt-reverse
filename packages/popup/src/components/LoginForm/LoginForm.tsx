// packages/popup/src/components/LoginForm/LoginForm.tsx
import React, { useState } from 'react';
import Button from '../Button/Button'; // Adjust path if necessary
import styles from './LoginForm.module.css'; // Use the CSS module
import { sendMessageToSW } from '../../utils/swMessenger'; // Adjust path

interface LoginFormProps {
    onSuccess: (userData: { uid: string, email: string | null }) => void; // Callback on successful login/register
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoginView, setIsLoginView] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(event.target.value);
        setError(null); // Clear error on input change
    };

    const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(event.target.value);
        setError(null); // Clear error on input change
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
        const messageType = isLoginView ? "LOGIN_USER" : "REGISTER_USER";

        try {
            // Use the robust messenger
            const response = await sendMessageToSW<{ uid: string, email: string | null }>({
                type: messageType,
                payload: { email, password },
            });
            console.log(`LoginForm: ${messageType} successful`, response);
            onSuccess(response); // Call parent's success handler

        } catch (err: any) {
            console.error(`LoginForm: Error during ${messageType}:`, err);
            setError(err.message || `An unknown error occurred during ${isLoginView ? 'login' : 'registration'}.`);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleView = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        setIsLoginView(!isLoginView);
        setError(null);
        setEmail('');
        setPassword('');
    };

    return (
        // Apply form class from module
        <form className={styles.form} onSubmit={handleSubmit}>
            <h2 className={styles.title}>
                {isLoginView ? "Login to Your Account" : "Create Your Account"} {/* Slightly more descriptive */}
            </h2>

            {/* Error message displayed first within the form */}
            {error && <p className={styles.errorMessage}>{error}</p>}

            <div className={styles.inputGroup}>
                <label htmlFor="login-email" className={styles.label}>Email Address</label>
                <input
                    type="email"
                    id="login-email"
                    value={email}
                    onChange={handleEmailChange}
                    required
                    className={styles.input} // Apply input class
                    placeholder="you@example.com"
                    disabled={isLoading}
                    aria-invalid={!!error} // Indicate invalid state for accessibility
                    aria-describedby={error ? "login-error" : undefined}
                />
            </div>

            <div className={styles.inputGroup}>
                <label htmlFor="login-password" className={styles.label}>Password</label>
                <input
                    type="password"
                    id="login-password"
                    value={password}
                    onChange={handlePasswordChange}
                    required
                    minLength={6}
                    className={styles.input} // Apply input class
                    placeholder="••••••••"
                    disabled={isLoading}
                    aria-invalid={!!error}
                    aria-describedby={error ? "login-error" : undefined}
                />
            </div>

            {/* Submit Button */}
            <Button
                type="submit"
                className={styles.submitButton} // Can add specific class if needed, but Button component takes care of base styling
                variant="primary" // Ensure it's the primary action style
                size="large" // Make the primary action button larger
                disabled={isLoading}
            >
                {isLoading && <div className={styles.spinner}></div>} {/* Use spinner class */}
                <span>{isLoginView ? "Login" : "Register"}</span>
            </Button>

            {/* Toggle Button */}
            <Button
                type="button"
                className={styles.toggleButton} // Apply specific class for toggle
                variant="ghost" // Use ghost variant for less emphasis
                onClick={toggleView}
                disabled={isLoading}
            >
                {isLoginView ? "Need an account? Register" : "Already have an account? Login"}
            </Button>

            {/* Add id to error message for aria-describedby */}
            {error && <div id="login-error" style={{ display: 'none' }}>{error}</div>}
        </form>
    );
};

export default LoginForm;
