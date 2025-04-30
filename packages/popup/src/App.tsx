// packages/popup/src/App.tsx
import React, { useState, useEffect } from "react";
import logo from "./assets/logo.svg";
import { theme } from "@shared"; // Import the theme object
import "./App.css"; // Keep for any non-theme related base styles if needed

// Define a simple type for the auth state we expect from the SW
interface AuthState {
    isLoggedIn: boolean;
    uid: string | null;
    email: string | null;
}

function App() {
    const [authState, setAuthState] = useState<AuthState>({ isLoggedIn: false, uid: null, email: null });
    const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true); // Start loading
    const [authError, setAuthError] = useState<string | null>(null);

    // --- Fetch Auth State from Service Worker on Popup Open ---
    useEffect(() => {
        const fetchAuthState = async () => {
            setIsLoadingAuth(true);
            setAuthError(null);
            try {
                console.log("Popup: Sending GET_AUTH_STATE message...");
                const response = await chrome.runtime.sendMessage({ type: "GET_AUTH_STATE" });
                console.log("Popup: Received auth state response:", response);

                if (response?.success && response.data) {
                    setAuthState({
                        isLoggedIn: true,
                        uid: response.data.uid,
                        email: response.data.email,
                    });
                } else if (response?.success && !response.data) {
                    setAuthState({ isLoggedIn: false, uid: null, email: null });
                } else {
                     // Handle potential errors reported by SW
                     setAuthError(response?.error?.message || "Failed to fetch auth state.");
                     setAuthState({ isLoggedIn: false, uid: null, email: null }); // Assume logged out on error
                }
            } catch (error: any) {
                console.error("Popup: Error sending GET_AUTH_STATE message:", error);
                setAuthError("Could not connect to extension background.");
                setAuthState({ isLoggedIn: false, uid: null, email: null }); // Assume logged out on comms error
            } finally {
                setIsLoadingAuth(false);
            }
        };

        fetchAuthState();

        // Optional: Listen for auth changes broadcast from the service worker
        // This requires the SW to send messages when auth state changes.
        const messageListener = (message: any, sender: chrome.runtime.MessageSender) => {
             if (message.type === 'AUTH_STATE_UPDATED') {
                  console.log("Popup: Received AUTH_STATE_UPDATED", message.payload);
                  setAuthState(message.payload); // Update state based on broadcast
             }
        };
        chrome.runtime.onMessage.addListener(messageListener);

        // Cleanup listener on unmount
        return () => {
           chrome.runtime.onMessage.removeListener(messageListener);
        };

    }, []); // Empty dependency array ensures this runs only once when the popup opens


    // --- Function to Open the Dedicated Auth Page ---
    const openAuthPage = () => {
        try {
            // Construct the URL relative to the extension's build output
            const authUrl = chrome.runtime.getURL("popup/auth.html");
            console.log("Popup: Opening auth page:", authUrl);
            chrome.tabs.create({ url: authUrl });
            window.close(); // Close the popup after opening the tab
        } catch (error) {
             console.error("Popup: Error opening auth page:", error);
             // Maybe display an error message in the popup itself
        }
    };

    // --- Function to Handle Logout ---
    const handleLogout = async () => {
         setIsLoadingAuth(true); // Use the same loading state for simplicity
         setAuthError(null);
         try {
             console.log("Popup: Sending LOGOUT_USER message...");
             const response = await chrome.runtime.sendMessage({ type: "LOGOUT_USER" });
             console.log("Popup: Received logout response:", response);

             if (response?.success) {
                 setAuthState({ isLoggedIn: false, uid: null, email: null }); // Update state immediately
                 // No need to fetch state again, assume logout worked
             } else {
                 setAuthError(response?.error?.message || "Logout failed.");
             }
         } catch (error: any) {
             console.error("Popup: Error sending LOGOUT_USER message:", error);
             setAuthError("Could not connect to extension background for logout.");
         } finally {
             setIsLoadingAuth(false);
         }
    };


    // --- Styling ---
    // Using the theme object for consistent styling
    const themeModeClass = theme.isDark ? "dark" : "light";

     const containerStyle: React.CSSProperties = {
        backgroundColor: theme.colors.backgroundPrimary,
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        padding: theme.spacing.large,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start", // Align items to the top
        width: "300px", // Fixed width typical for popups
        minHeight: "350px", // Give it some minimum height
        boxSizing: 'border-box',
        gap: theme.spacing.medium,
        textAlign: "center",
     };

     const logoStyle: React.CSSProperties = {
         width: "48px", // Slightly smaller logo for popup
         height: "48px",
         marginBottom: theme.spacing.small,
     };

    const titleStyle: React.CSSProperties = {
        fontSize: theme.typography.fontSize.large, // Slightly smaller title
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.accentPrimary,
        margin: 0, // Remove default margins
    };

     const descriptionStyle: React.CSSProperties = {
        color: theme.colors.textSecondary,
        fontSize: theme.typography.fontSize.small,
        margin: 0,
        maxWidth: '90%', // Prevent text from touching edges
     };

    const instructionBoxStyle: React.CSSProperties = {
        backgroundColor: theme.colors.backgroundSecondary,
        padding: theme.spacing.medium,
        borderRadius: theme.borderRadius.medium,
        border: `1px solid ${theme.colors.borderSecondary}`,
        width: "100%",
        maxWidth: "260px", // Adjust max-width for popup
        boxShadow: theme.shadows.small,
        marginTop: theme.spacing.small, // Add some space above
    };

    const instructionTextStyle: React.CSSProperties = {
        color: theme.colors.textPrimary,
        fontWeight: theme.typography.fontWeight.medium,
        marginBottom: theme.spacing.small,
        fontSize: theme.typography.fontSize.medium,
        margin: 0,
    };

    const shortcutContainerStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: theme.spacing.xsmall,
        marginTop: theme.spacing.small,
    };

    const kbdStyle: React.CSSProperties = {
        display: "inline-block",
        padding: `${theme.spacing.xxsmall} ${theme.spacing.xsmall}`,
        fontSize: theme.typography.fontSize.small,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.accentPrimary,
        backgroundColor: theme.colors.backgroundActive,
        border: `1px solid ${theme.colors.borderPrimary}`,
        borderRadius: theme.borderRadius.small,
        boxShadow: theme.shadows.small,
    };

     const accountSectionStyle: React.CSSProperties = {
        width: '100%',
        maxWidth: '260px',
        marginTop: theme.spacing.medium,
        paddingTop: theme.spacing.medium,
        borderTop: `1px solid ${theme.colors.borderSecondary}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: theme.spacing.small,
    };

    const buttonStyle: React.CSSProperties = {
        padding: `${theme.spacing.small} ${theme.spacing.large}`, // Make button slightly larger
        minWidth: '150px', // Give button minimum width
        backgroundColor: theme.colors.accentPrimary,
        color: theme.colors.backgroundPrimary,
        border: 'none',
        borderRadius: theme.borderRadius.small,
        fontSize: theme.typography.fontSize.medium,
        fontWeight: theme.typography.fontWeight.semibold,
        cursor: 'pointer',
        transition: `background-color ${theme.transitions.duration.fast} ${theme.transitions.easing}, opacity ${theme.transitions.duration.fast} ${theme.transitions.easing}`,
    };

     const logoutButtonStyle: React.CSSProperties = { // Subtle difference for logout
        ...buttonStyle,
        backgroundColor: theme.colors.backgroundHover,
        color: theme.colors.textSecondary,
        border: `1px solid ${theme.colors.borderPrimary}`,
     };

     const buttonHoverStyle: React.CSSProperties = { backgroundColor: theme.colors.accentHover };
     const logoutButtonHoverStyle: React.CSSProperties = { backgroundColor: theme.colors.backgroundActive, color: theme.colors.error, borderColor: theme.colors.error };

     const buttonDisabledStyle: React.CSSProperties = { opacity: 0.6, cursor: 'not-allowed' };

    const errorTextStyle: React.CSSProperties = {
        color: theme.colors.error,
        fontSize: theme.typography.fontSize.small,
        marginTop: theme.spacing.small,
    };

    return (
        <div className={`AppContainer ${themeModeClass}`} style={containerStyle}>
            <img src={logo} alt="Extension Logo" style={logoStyle} />

            <h1 style={titleStyle}>ChatGPT Reverse</h1>

            <p style={descriptionStyle}>Your enhancement tools are ready!</p>

            {/* Core Instruction */}
            <div style={instructionBoxStyle}>
                <p style={instructionTextStyle}>How to Access Tools:</p>
                <p style={{...descriptionStyle, marginBottom: theme.spacing.small }}>
                    On{" "}
                    <code style={{...kbdStyle, padding: '1px 4px', fontSize: '11px'}}>
                        chatgpt.com
                    </code>
                    , press:
                </p>
                <div style={shortcutContainerStyle}>
                    <kbd style={kbdStyle}>CTRL</kbd>
                    <span style={{ color: theme.colors.textSecondary, fontWeight: 'bold', margin: '0 2px' }}>+</span>
                    <kbd style={kbdStyle}>G</kbd>
                </div>
            </div>

             {/* Account Section */}
            <div style={accountSectionStyle}>
                 {isLoadingAuth ? (
                    <p style={descriptionStyle}>Loading account status...</p>
                 ) : authState.isLoggedIn ? (
                    <>
                        <p style={{...descriptionStyle, fontWeight: 'normal' }}>
                            Logged in as: <strong style={{ color: theme.colors.textPrimary }}>{authState.email}</strong>
                        </p>
                        <button
                            onClick={handleLogout}
                            style={logoutButtonStyle}
                            onMouseEnter={(e) => Object.assign(e.currentTarget.style, logoutButtonHoverStyle)}
                            onMouseLeave={(e) => Object.assign(e.currentTarget.style, logoutButtonStyle)}
                        >
                            Logout
                        </button>
                        {/* Optional: Add a button to manage account / go to auth page again */}
                        {/* <button onClick={openAuthPage} style={{...buttonStyle, marginTop: theme.spacing.small, backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary, border: `1px solid ${theme.colors.borderPrimary}`}}>Manage Account</button> */}
                    </>
                ) : (
                    <>
                         <p style={descriptionStyle}>Login or Register for premium features.</p>
                         <button
                            onClick={openAuthPage}
                            style={buttonStyle}
                            onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHoverStyle)}
                            onMouseLeave={(e) => Object.assign(e.currentTarget.style, buttonStyle)}
                        >
                            Login / Register
                        </button>
                    </>
                )}
                {authError && <p style={errorTextStyle}>{authError}</p>}
            </div>

            {/* Footer Hint is less relevant now with explicit login */}
            {/*
            <p style={{ color: theme.colors.textSecondary, fontSize: '10px', marginTop: 'auto', paddingTop: theme.spacing.small, opacity: 0.8 }}>
                You can close this popup. The main window opens directly on the page.
            </p>
             */}
        </div>
    );
}

export default App;
