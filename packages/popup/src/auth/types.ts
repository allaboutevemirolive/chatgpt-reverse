// packages/popup/src/auth/types.ts
export interface UserData {
    uid: string;
    email: string | null;
}

export interface AuthState {
    isLoggedIn: boolean;
    uid: string | null;
    email: string | null;
}

export interface UserSubscription {
    planId: "free" | "monthly" | "lifetime" | null;
    status?: string | null;
}

export type AuthPageView = "pricing" | "login" | "account";

export type CheckoutPlanId = "monthly" | "lifetime";
