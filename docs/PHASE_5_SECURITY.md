# Phase 5 Security, Privacy & Safety Architecture

## 1. Multi-Tenant Firestore Security
Under `firestore.rules`:
```rules
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;

  match /appData/{document=**} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
}
```
All financial records (accounts, transactions, budgets) and personal wellbeing logs (hydration, habits, check-ins) are stored under `/users/{userId}/appData/`, guaranteeing that:
1. Unauthenticated users cannot read or write data.
2. User A cannot access or tamper with User B's financial transactions or wellbeing reflections.

---

## 2. Financial Safety & Zero Banking Credentials
- **No Banking Passwords:** Planrova never requests, collects, or stores banking credentials, PINs, OTPs, or debit/credit card numbers.
- **No Automated Fund Movements:** The system tracks user-recorded transactions; it never initiates automated payments or wire transfers.
- **Credential Redaction:** Centralized logger redacts API keys, bearer tokens, and credentials from all runtime logs (`tests/logger.test.js`).

---

## 3. Wellbeing Safety & Non-Clinical Reflection
- **Personal Reflection Only:** Check-ins record energy and mood for self-reflection; they never provide psychological diagnostics or mental-health conclusions.
- **No Medical Claims:** Hydration metrics provide habit-tracking progress against user-chosen targets, never clinical advice.

