// src/firebase/stripe.ts
import {
    collection,
    addDoc,
    onSnapshot,
    DocumentReference,
    DocumentData,
    FirestoreError,
    Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./core";
import { getCurrentUser } from "./auth"; // Import function to get user
import {
    STRIPE_PRICE_ID_MONTHLY,
    STRIPE_PRICE_ID_LIFETIME,
    CHECKOUT_SUCCESS_URL,
    CHECKOUT_CANCEL_URL,
    CHECKOUT_LISTENER_TIMEOUT,
    FIRESTORE_CUSTOMERS_COLLECTION,
    FIRESTORE_CHECKOUT_SESSIONS_SUBCOLLECTION,
} from "@/config/constants";

interface CheckoutSessionDocData {
    url?: string;
    error?: { message: string };
}

/**
 * Creates a Firestore document to trigger the Stripe Checkout session creation extension.
 * Listens for the URL or error added back to the document by the extension.
 * @param planId - The identifier for the plan ('monthly' or 'lifetime').
 * @returns A promise resolving with the Stripe Checkout URL string.
 * @throws An error if the user is not logged in, the planId is invalid,
 *         the Price ID is missing, Firestore operation fails,
 *         the extension reports an error, or the operation times out.
 */
export async function getCheckoutUrl(
    planId: "monthly" | "lifetime",
): Promise<string> { // Return type is now string
    const currentUser = getCurrentUser(); // Get the cached current user
    const userId = currentUser?.uid;

    if (!userId) {
        console.error("Firebase Stripe (getCheckoutUrl): User not logged in.");
        throw new Error("User must be logged in to start checkout.");
    }

    let priceId: string | undefined;
    let mode: "payment" | "subscription";

    switch (planId) {
        case "monthly":
            priceId = STRIPE_PRICE_ID_MONTHLY;
            mode = "subscription";
            break;
        case "lifetime":
            priceId = STRIPE_PRICE_ID_LIFETIME;
            mode = "payment";
            break;
        default:
            // Should be caught by validation in background.ts, but defensive check here
            console.error(`Firebase Stripe (getCheckoutUrl): Invalid planId: ${planId}`);
            throw new Error(`Invalid plan selected.`);
    }

    if (!priceId) {
        console.error(
            `Firebase Stripe (getCheckoutUrl): Stripe Price ID missing for plan: ${planId}. Check constants.`,
        );
        throw new Error(
            `Configuration error: Price ID for the selected plan is missing.`,
        );
    }

    console.log(
        `Firebase Stripe (getCheckoutUrl): Creating checkout session doc for user ${userId}, price ${priceId}`,
    );
    const db = getDb();
    const checkoutSessionCollection = collection(
        db,
        FIRESTORE_CUSTOMERS_COLLECTION,
        userId,
        FIRESTORE_CHECKOUT_SESSIONS_SUBCOLLECTION,
    );

    try {
        // Create the document in Firestore to trigger the extension
        const docRef: DocumentReference<DocumentData> = await addDoc(
            checkoutSessionCollection,
            {
                price: priceId,
                success_url: CHECKOUT_SUCCESS_URL,
                cancel_url: CHECKOUT_CANCEL_URL,
                mode: mode,
                // auto_tax: true // Optionally enable automatic tax calculation
                // allow_promotion_codes: true // Optionally enable promo codes
                // metadata: { source: 'chrome-extension-auth-page' } // Optional metadata
            },
        );

        console.log("Firebase Stripe (getCheckoutUrl): Checkout session document created:", docRef.id);

        // Wait for the Stripe Extension to update the document with the URL
        return new Promise<string>((resolve, reject) => { // Promise resolves with string
            let timedOut = false;
            let unsubscribeCalled = false;
            let timeoutHandle: NodeJS.Timeout | null = null;
            let unsubscribeFirestore: Unsubscribe | null = null;

            const cleanup = (error?: Error) => {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                timeoutHandle = null;
                if (unsubscribeFirestore && !unsubscribeCalled) {
                    unsubscribeCalled = true;
                    console.log("Firebase Stripe (getCheckoutUrl): Unsubscribing listener for", docRef.id);
                    unsubscribeFirestore();
                    unsubscribeFirestore = null;
                }
                if (error && !timedOut) { // Don't reject again if already timed out
                    reject(error);
                }
            };

            unsubscribeFirestore = onSnapshot(
                docRef,
                (snap) => {
                    if (timedOut || unsubscribeCalled) return;
                    const data = snap.data() as CheckoutSessionDocData | undefined; // Type assertion
                    console.log(
                        "Firebase Stripe (getCheckoutUrl): Snapshot update:", docRef.id, JSON.stringify(data || {})
                    );

                    // Check for error first
                    if (data?.error) {
                        console.error(
                            "Firebase Stripe (getCheckoutUrl): Stripe extension reported error:", data.error
                        );
                        cleanup(new Error(`Checkout failed: ${data.error.message || "Unknown Stripe error"}`));
                    }
                    // Then check for URL
                    else if (data?.url) {
                        console.log(
                            "Firebase Stripe (getCheckoutUrl): URL retrieved:", data.url
                        );
                        cleanup(); // Clean up listener successfully
                        resolve(data.url); // Resolve the promise with the URL string
                    }
                    // Otherwise, keep listening...
                    else {
                        console.log(`Firebase Stripe: Snapshot for ${docRef.id} updated, still waiting for url/error.`);
                    }
                },
                (error: FirestoreError) => { // Handle listener errors
                    if (timedOut || unsubscribeCalled) return;
                    console.error(
                        "Firebase Stripe (getCheckoutUrl): Firestore listener error:", docRef.id, error
                    );
                    cleanup(new Error(`Failed to listen for checkout session updates: ${error.message}`));
                },
            );

            // Set timeout
            timeoutHandle = setTimeout(() => {
                if (timedOut || unsubscribeCalled) return;
                timedOut = true; // Mark as timed out
                console.warn(
                    `Firebase Stripe (getCheckoutUrl): Timeout (${CHECKOUT_LISTENER_TIMEOUT}ms) waiting for URL for doc ${docRef.id}`
                );
                // Reject *only if* cleanup hasn't already happened due to error/success
                if (!unsubscribeCalled) {
                    cleanup(new Error("Timeout waiting for Stripe Checkout URL. Please try again."));
                }
            }, CHECKOUT_LISTENER_TIMEOUT);
        }); // End of Promise

    } catch (error) { // Catch errors during addDoc
        console.error(
            "Firebase Stripe (getCheckoutUrl): Firestore error adding checkout session doc:",
            error,
        );
        throw new Error(
            `Failed to initiate checkout Firestore operation: ${(error as Error).message}`,
        );
    }
}
