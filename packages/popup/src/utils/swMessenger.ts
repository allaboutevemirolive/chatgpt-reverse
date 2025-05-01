// packages/popup/src/utils/swMessenger.ts

export type SendMessageToSW = <T = any>(message: {
    type: string;
    payload?: any;
}) => Promise<T>;

interface SWResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        name?: string;
        message: string;
        stack?: string;
    };
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 350;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const CONNECTION_ERROR_MESSAGE =
    "Could not connect to the extension's background service. It might be inactive. Please try again shortly.";

/**
 * Sends a message to the background service worker from Popup/Extension Pages
 * and handles the response. Includes a retry mechanism for connection errors.
 * @param message - The message object with type and payload.
 * @returns A promise that resolves with the data from the service worker on success.
 * @throws An error object if the service worker returns an error or communication fails after retries.
 */
export const sendMessageToSW: SendMessageToSW = async <T>(message: {
    type: string;
    payload?: any;
}): Promise<T> => {
    console.log(
        `Popup Helper: Sending message -> Type: ${message.type}`,
        message.payload ?? "[No payload]",
    );

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response: SWResponse<T> | undefined =
                await chrome.runtime.sendMessage(message);

            // --- Standard Response Handling ---

            // 1. Check chrome.runtime.lastError (most reliable for connection errors)
            if (chrome.runtime.lastError) {
                const lastErrorMessage =
                    chrome.runtime.lastError.message ?? "Unknown runtime error";
                console.warn(
                    `Popup Helper: chrome.runtime.lastError (Attempt ${attempt + 1}/${MAX_RETRIES + 1}) for ${message.type}:`,
                    lastErrorMessage,
                );
                if (
                    lastErrorMessage.includes("Receiving end does not exist") ||
                    lastErrorMessage.includes("message port closed") // Another potential connection error wording
                ) {
                    if (attempt < MAX_RETRIES) {
                        console.warn(
                            `Popup Helper: Connection error (lastError) on attempt ${attempt + 1}. Retrying after ${RETRY_DELAY_MS}ms...`,
                        );
                        await delay(RETRY_DELAY_MS);
                        continue; // Go to the next retry iteration
                    } else {
                        // Final attempt failed with connection error
                        throw new Error(CONNECTION_ERROR_MESSAGE);
                    }
                }
                // If it's a different lastError, throw it directly without retry
                throw new Error(
                    `Service worker communication error: ${lastErrorMessage}`,
                );
            }

            // 2. Check for undefined response (less common, but possible if SW crashes mid-response)
            if (response === undefined) {
                console.warn(
                    `Popup Helper: Received undefined response (Attempt ${attempt + 1}/${MAX_RETRIES + 1}) for ${message.type}. SW might be unstable.`,
                );
                if (attempt < MAX_RETRIES) {
                    console.warn(
                        `Popup Helper: Undefined response on attempt ${attempt + 1}. Retrying after ${RETRY_DELAY_MS}ms...`,
                    );
                    await delay(RETRY_DELAY_MS);
                    continue; // Treat as potentially recoverable for retry
                }
                throw new Error(
                    "Received undefined response from service worker after retries. Service worker might have crashed.",
                );
            }

            // 3. Check the structured response { success: boolean, ... }
            if (response.success) {
                console.log(
                    `Popup Helper: Received successful response <- (Attempt ${attempt + 1}/${MAX_RETRIES + 1}) for ${message.type}`,
                );
                // Ensure data exists if success is true, handle cases where SW might return success: true without data
                return (response.data ?? null) as T; // Return data or null if undefined
            } else {
                // SW explicitly reported an error (e.g., API failure, validation error)
                // No need to retry these application-level errors.
                const error = new Error(
                    response.error?.message ||
                        `Unknown error from service worker for ${message.type}.`,
                );
                error.name = response.error?.name || "ServiceWorkerError";
                // Note: Stacks might not be properly serialized across the message boundary
                // error.stack = response.error?.stack;
                console.error(
                    `Popup Helper: Error reported by Service Worker (Attempt ${attempt + 1}/${MAX_RETRIES + 1}) for ${message.type}:`,
                    error,
                );
                throw error; // Propagate SW-reported error
            }
            // --- End Standard Response Handling ---
        } catch (error: any) {
            // --- Catch errors during the sendMessage call itself OR errors thrown from above checks ---
            console.warn(
                `Popup Helper: Catch block triggered for ${message.type} (Attempt ${attempt + 1}/${MAX_RETRIES + 1}). Error:`,
                error.message,
            );

            // Check if it's the specific connection error message we look for AND if retries are left
            if (
                (error.message?.includes("Receiving end does not exist") ||
                    error.message?.includes("message port closed")) && // Check catch block error message too
                attempt < MAX_RETRIES
            ) {
                console.warn(
                    `Popup Helper: Connection error caught on attempt ${attempt + 1}. Retrying after ${RETRY_DELAY_MS}ms...`,
                );
                await delay(RETRY_DELAY_MS);
                // continue will automatically go to the next iteration of the for loop
            } else {
                // If it's not the specific connection error, OR if retries are exhausted, throw the error.
                console.error(
                    `Popup Helper: Final error after ${attempt + 1} attempts for message ${message.type}:`,
                    error, // Log the full error object now
                );
                // Use the specific, user-friendly error message for known connection failures after retries
                if (
                    error.message?.includes("Receiving end does not exist") ||
                    error.message?.includes("message port closed")
                ) {
                    throw new Error(CONNECTION_ERROR_MESSAGE);
                }
                // Re-throw other types of errors (like SW-reported errors or unexpected runtime issues)
                throw error;
            }
            // --- End Catch Block ---
        }
    }

    // This line should theoretically not be reached if MAX_RETRIES >= 0 and the loop always either continues, returns, or throws.
    // It acts as a final safety net.
    console.error(
        `Popup Helper: Service worker communication failed unexpectedly for message type "${message.type}" after all retries.`,
    );
    throw new Error(
        `Service worker communication failed for message type "${message.type}" after all retries.`,
    );
};
