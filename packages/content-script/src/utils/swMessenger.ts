// packages/content-script/src/utils/swMessenger.ts
export type SendMessageToSW = <T = any>(message: {
    type: string;
    payload?: any;
}) => Promise<T>;

const MAX_RETRIES = 2; // Number of retries (total attempts = MAX_RETRIES + 1)
const RETRY_DELAY_MS = 300; // Delay between retries in milliseconds

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends a message to the background service worker and handles the response.
 * Includes a retry mechanism for connection errors.
 * @param message - The message object with type and payload.
 * @returns A promise that resolves with the data from the service worker on success.
 * @throws An error object if the service worker returns an error or communication fails after retries.
 */
export const sendMessageToSW: SendMessageToSW = async (message) => {
    console.log(
        "Content Helper: Sending message ->",
        message.type,
        message.payload ?? "",
    );

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await chrome.runtime.sendMessage(message);

            // --- Standard Response Handling (check lastError first) ---
            if (chrome.runtime.lastError) {
                console.error(
                    `Content Helper: chrome.runtime.lastError (Attempt ${attempt + 1}/${MAX_RETRIES + 1}):`,
                    chrome.runtime.lastError.message,
                );
                // Check if it's the specific connection error and if retries are left
                if (
                    chrome.runtime.lastError.message?.includes(
                        "Receiving end does not exist",
                    ) &&
                    attempt < MAX_RETRIES
                ) {
                    console.warn(
                        `Content Helper: Connection error (lastError) on attempt ${attempt + 1}. Retrying after ${RETRY_DELAY_MS}ms...`,
                    );
                    await delay(RETRY_DELAY_MS);
                    continue; // Go to the next retry iteration
                }
                // If not the connection error, or retries exhausted, throw
                throw new Error(
                    `Service worker communication error: ${chrome.runtime.lastError.message}`,
                );
            }

            // Check for undefined response (can sometimes happen if SW crashes during processing)
            if (response === undefined) {
                console.error(
                    `Content Helper: Received undefined response (Attempt ${attempt + 1}/${MAX_RETRIES + 1}). SW might be unstable.`,
                );
                // Treat undefined response like a connection error for retry purposes
                if (attempt < MAX_RETRIES) {
                    console.warn(
                        `Content Helper: Undefined response on attempt ${attempt + 1}. Retrying after ${RETRY_DELAY_MS}ms...`,
                    );
                    await delay(RETRY_DELAY_MS);
                    continue; // Go to the next retry iteration
                }
                // If retries exhausted
                throw new Error(
                    "Received undefined response from service worker after retries.",
                );
            }

            // Check the success flag from the response structure
            if (response?.success) {
                console.log(
                    `Content Helper: Received successful response <- (Attempt ${attempt + 1}/${MAX_RETRIES + 1})`,
                );
                return response.data; // SUCCESS: Exit the loop and return data
            } else {
                // If the SW responded but indicated failure, construct and throw the error. Don't retry logical errors.
                const error = new Error(
                    response.error?.message ||
                        "Unknown error from service worker.",
                );
                error.name = response.error?.name || "ServiceWorkerError";
                if (response.error?.stack) {
                    error.stack = response.error.stack;
                }
                console.error(
                    `Content Helper: Error received from Service Worker (Attempt ${attempt + 1}/${MAX_RETRIES + 1}):`,
                    error,
                );
                throw error; // Propagate SW-reported error (no retry needed)
            }
            // --- End Standard Response Handling ---
        } catch (error: any) {
            // --- Catch errors during the sendMessage call itself (like connection errors) ---
            console.warn(
                // Use warn for potentially transient connection errors during retry
                `Content Helper: Error during sendMessage attempt ${attempt + 1}/${MAX_RETRIES + 1}:`,
                error.message, // Log only the message initially for retry attempts
            );

            // Check specifically for the connection error message AND if retries are left
            if (
                error.message?.includes("Receiving end does not exist") &&
                attempt < MAX_RETRIES
            ) {
                console.warn(
                    `Content Helper: Connection error on attempt ${attempt + 1}. Retrying after ${RETRY_DELAY_MS}ms...`,
                );
                await delay(RETRY_DELAY_MS);
                // continue will automatically go to the next iteration of the for loop
            } else {
                // If it's not the specific connection error, OR if retries are exhausted, throw the error.
                console.error(
                    `Content Helper: Final error after ${attempt + 1} attempts for message ${message.type}:`,
                    error, // Log the full error now
                );
                // Use the specific, user-friendly error message for connection failures
                if (error.message?.includes("Receiving end does not exist")) {
                    throw new Error(
                        "Cannot connect to the extension's service worker. It might be inactive or crashed. Please try refreshing the page or reloading the extension.",
                    );
                }
                // Re-throw other types of errors or the connection error after max retries
                throw error;
            }
            // --- End Catch Block ---
        }
    }

    // This line should theoretically not be reached if MAX_RETRIES >= 0,
    // but it acts as a final safety net.
    throw new Error(
        `Service worker communication failed for message type "${message.type}" after all retries.`,
    );
};
