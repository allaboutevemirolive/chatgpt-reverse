// packages/service-worker/src/firebase/stripe.ts
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    DocumentReference,
    DocumentData,
    FirestoreError,
    Unsubscribe,
} from "firebase/firestore";
import { getDb, getFirebaseApp } from "./core";
import { getCurrentUser } from "./auth";
import {
    STRIPE_PRICE_ID_MONTHLY,
    STRIPE_PRICE_ID_LIFETIME,
    CHECKOUT_SUCCESS_URL,
    CHECKOUT_CANCEL_URL,
    CHECKOUT_LISTENER_TIMEOUT,
    FIRESTORE_CUSTOMERS_COLLECTION,
    FIRESTORE_CHECKOUT_SESSIONS_SUBCOLLECTION,
    FIRESTORE_SUBSCRIPTIONS_SUBCOLLECTION,
} from "@/config/constants";
import { getFunctions, httpsCallable } from "firebase/functions";

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
): Promise<string> {
    const currentUser = getCurrentUser();
    const userId = currentUser?.uid;

    if (!userId) {
        console.error("Firebase Stripe (getCheckoutUrl): User not logged in.");
        throw new Error("User must be logged in to start checkout.");
    }

    // Determine the correct Stripe Price ID based on the internal planId
    let priceId: string | undefined;
    let mode: "payment" | "subscription";

    switch (planId) {
        case "monthly":
            // Map internal 'monthly' to the actual Stripe Price ID from constants
            priceId = STRIPE_PRICE_ID_MONTHLY;
            mode = "subscription";
            break;
        case "lifetime":
            // Map internal 'lifetime' to the actual Stripe Price ID from constants
            priceId = STRIPE_PRICE_ID_LIFETIME;
            mode = "payment";
            break;
        default:
            console.error(`Firebase Stripe (getCheckoutUrl): Invalid planId: ${planId}`);
            throw new Error(`Invalid plan selected.`);
    }

    if (!priceId) {
        console.error(
            `Firebase Stripe (getCheckoutUrl): Stripe Price ID missing or misconfigured for plan: ${planId}. Check constants.ts.`,
        );
        throw new Error(
            `Configuration error: Price ID for the selected plan is missing.`,
        );
    }

    console.log(
        `Firebase Stripe (getCheckoutUrl): Creating checkout session doc for user ${userId}, price ${priceId} (plan: ${planId})`,
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
                price: priceId, // Use the mapped Stripe Price ID
                success_url: CHECKOUT_SUCCESS_URL,
                cancel_url: CHECKOUT_CANCEL_URL,
                mode: mode,
                // Optionally add metadata to link back to your internal planId if needed
                metadata: { internalPlanId: planId }
            },
        );

        console.log("Firebase Stripe (getCheckoutUrl): Checkout session document created:", docRef.id);

        // Wait for the Stripe Extension to update the document with the URL
        // (Promise logic remains the same as before)
        return new Promise<string>((resolve, reject) => {
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
                    const data = snap.data() as CheckoutSessionDocData | undefined;
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
                        cleanup();
                        resolve(data.url);
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


/**
 * Fetches the subscription status for a given user from Firestore.
 * Checks the subscriptions subcollection for the latest active subscription.
 * @param userId - The Firebase Authentication user ID.
 * @returns A promise resolving with the user's subscription data (planId and status) or null if error.
 */
export async function getSubscriptionStatus(
    userId: string,
): Promise<{ planId: "free" | "monthly" | "lifetime"; status: string | null } | null> {
    if (!userId) {
        console.error("Firebase Stripe (getSubscriptionStatus): userId is required.");
        return null; // Or throw new Error("User ID required");
    }
    const db = getDb();
    // Reference the 'subscriptions' subcollection using the constant
    const subsRef = collection(
        db,
        FIRESTORE_CUSTOMERS_COLLECTION,
        userId,
        FIRESTORE_SUBSCRIPTIONS_SUBCOLLECTION, // Use constant here
    );

    try {
        console.log(
            `Firebase Stripe (getSubscriptionStatus): Querying '${FIRESTORE_SUBSCRIPTIONS_SUBCOLLECTION}' subcollection for user ${userId}`,
        );
        // Query for the latest subscription with an active-like status
        const q = query(
            subsRef,
            where("status", "in", ["active", "trialing"]), // Check for active or trialing status
            orderBy("created", "desc"), // Get the latest one if multiple exist
            limit(1),
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.log(
                `Firebase Stripe (getSubscriptionStatus): No active/trialing subscription found for user ${userId}. Assuming free plan.`,
            );
            // If no active subscription found, assume free
            return { planId: "free", status: null };
        }

        // Get the data from the first (and only) document in the result
        const subDoc = querySnapshot.docs[0];
        const subData = subDoc.data();
        console.log(
            `Firebase Stripe (getSubscriptionStatus): Active subscription data found for ${userId} (Doc ID: ${subDoc.id}):`,
            subData,
        );

        // --- Determine Plan ID based on Stripe Price ID ---
        let resolvedPlanId: "free" | "monthly" | "lifetime" = "free"; // Default to free
        const priceId = subData?.items?.[0]?.price?.id; // Safely access nested Price ID

        if (!priceId) {
            console.warn(`Firebase Stripe (getSubscriptionStatus): Subscription document ${subDoc.id} for user ${userId} is missing items[0].price.id. Assuming free.`);
        } else if (priceId === STRIPE_PRICE_ID_MONTHLY) {
            resolvedPlanId = "monthly";
        } else if (priceId === STRIPE_PRICE_ID_LIFETIME) {
            resolvedPlanId = "lifetime";
        } else {
            console.warn(`Firebase Stripe (getSubscriptionStatus): Unknown priceId '${priceId}' found for user ${userId}. Assuming free.`);
        }

        const resolvedStatus = subData?.status || null; // Get the status directly

        console.log(
            `Firebase Stripe (getSubscriptionStatus): Resolved planId=${resolvedPlanId}, status=${resolvedStatus} for ${userId} from subscription ${subDoc.id}`,
        );
        return { planId: resolvedPlanId, status: resolvedStatus };

    } catch (error) {
        console.error(
            `Firebase Stripe (getSubscriptionStatus): Error fetching subscription for user ${userId}:`,
            error,
        );
        return null;
    }
}

/**
 * Calls the Firebase Cloud Function to create a Stripe Customer Portal session URL.
 * @returns A promise resolving with the portal URL string.
 * @throws An error if the user is not logged in or the Cloud Function call fails.
 */
export async function createPortalSession(): Promise<string> {
    const currentUser = getCurrentUser();
    const userId = currentUser?.uid;

    if (!userId) {
        console.error("Firebase Stripe (createPortalSession): User not logged in.");
        throw new Error("User must be logged in to manage billing.");
    }

    try {
        const app = getFirebaseApp();
        // TODO: Specify the region if our function is not in 'us-central1' 
        const functions = getFunctions(app /*, "our-function-region" */);
        const functionRef = httpsCallable<
            { returnUrl: string },
            { url: string }
        >(functions, 'ext-firestore-stripe-payments-createPortalLink');

        console.log(`Firebase Stripe (createPortalSession): Calling function for user ${userId}`);

        const returnUrl = CHECKOUT_SUCCESS_URL;

        const { data } = await functionRef({ returnUrl });

        if (!data?.url) {
            console.error("Firebase Stripe (createPortalSession): No URL returned from function. Response data:", data);
            throw new Error('Cloud function did not return a portal URL.');
        }

        console.log('Firebase Stripe (createPortalSession): Portal URL retrieved:', data.url);
        return data.url;

    } catch (error: any) {
        console.error('Firebase Stripe (createPortalSession): Error calling createPortalLink function:', error);
        if (error.code === 'functions/not-found') {
            throw new Error("Billing management function not found. Please ensure the Stripe Payments extension is correctly installed and deployed.");
        } else if (error.code === 'functions/permission-denied') {
            throw new Error("You do not have permission to access billing management.");
        }
        throw new Error(`Could not create customer portal session: ${error.message || 'Unknown function error'}`);
    }
}
