// packages/popup/src/components/LoginForm/LoginForm.tsx
import React, { useState } from 'react';
import Button from '../Button/Button'; // Adjust path
import styles from './LoginForm.module.css';
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
        setError(null);
    };

    const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(event.target.value);
        setError(null);
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
        setError(null); // Clear error when toggling
        setEmail(''); // Optional: clear fields on toggle
        setPassword('');
    };

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            <h2 className={styles.title}>
                {isLoginView ? "Login" : "Register"}
            </h2>

             {error && <p className={styles.errorMessage}>{error}</p>}

            <div className={styles.inputGroup}>
                <label htmlFor="login-email" className={styles.label}>Email Address</label>
                <input
                    type="email"
                    id="login-email" // Unique ID
                    value={email}
                    onChange={handleEmailChange}
                    required
                    className={styles.input}
                    placeholder="you@example.com"
                    disabled={isLoading}
                />
            </div>

            <div className={styles.inputGroup}>
                <label htmlFor="login-password" className={styles.label}>Password</label>
                <input
                    type="password"
                    id="login-password" // Unique ID
                    value={password}
                    onChange={handlePasswordChange}
                    required
                    minLength={6}
                    className={styles.input}
                    placeholder="••••••••"
                    disabled={isLoading}
                />
            </div>

            <Button
                type="submit"
                className={styles.submitButton}
                variant="primary"
                disabled={isLoading}
            >
                {isLoading && <div className={styles.spinner}></div>}
                <span>{isLoginView ? "Login" : "Register"}</span>
            </Button>

            <Button
                type="button"
                className={styles.toggleButton}
                variant="ghost" // Use ghost style for toggle
                onClick={toggleView}
                disabled={isLoading}
            >
                {isLoginView ? "Need an account? Register" : "Already have an account? Login"}
            </Button>
        </form>
    );
};

export default LoginForm;
