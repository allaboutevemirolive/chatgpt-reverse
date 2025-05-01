// src/config/constants.ts

// --- Stripe Configuration ---
export const STRIPE_PRICE_ID_MONTHLY = "price_1RJwp5GBa76vUuq3NNO39uvH";
export const STRIPE_PRICE_ID_LIFETIME = "price_1RJwp5GBa76vUuq3NNO39uvH";

// --- Checkout URLs ---
const HOSTING_BASE_URL = "https://chatgpt-reverse.web.app";
export const CHECKOUT_SUCCESS_URL = `${HOSTING_BASE_URL}/checkout-success.html`;
export const CHECKOUT_CANCEL_URL = `${HOSTING_BASE_URL}/checkout-cancel.html`;

// --- Timeouts ---
export const CHECKOUT_LISTENER_TIMEOUT = 30000; // 30 seconds

// --- Firestore ---
export const FIRESTORE_DB_NAME = "chatgpt-reverse-db";
export const FIRESTORE_CUSTOMERS_COLLECTION = "customers";
export const FIRESTORE_CHECKOUT_SESSIONS_SUBCOLLECTION = "checkout_sessions";

// --- Storage Keys ---
export const STORAGE_API_HEADERS_KEY = "apiHeaders";
export const STORAGE_AUTH_DATA_KEY = "authData";
