// Brand constants in one place, so a rename or a new domain is a one-line change.
export const APP_NAME = 'Tend';

/** Android application id (app.json → android.package). */
export const ANDROID_PACKAGE = 'com.tend.app';

// Placeholder slug until the public site is live.
const SITE = 'https://hashhorizon.in/app/tend';

export const LEGAL = {
  privacy: `${SITE}/privacy`,
  terms: `${SITE}/terms`,
  deleteAccount: `${SITE}/delete-account`,
} as const;

export const SUPPORT_EMAIL = 'support@hashhorizon.in';
