# Academic Storage, Multi-Tenant Isolation & Sync Architecture

## 1. Local-First Storage Architecture
Academic entities are stored in Planrova's local-first storage layer:
- **Instant In-Memory Cache**: Zero-latency reads and writes for smooth 60fps UI rendering.
- **Dexie.js (IndexedDB)**: Client-side persistent offline database (`kv_store` table).
- **Cloud Firestore**: Seamless background multi-device synchronization.

---

## 2. Storage Keys & Account Isolation

### 2.1 Storage Keys
All academic collections are partitioned under scoped keys:
- `academic_semesters`
- `academic_courses`
- `academic_syllabus_topics`
- `academic_assessments`
- `academic_assignments`
- `academic_flashcard_decks`
- `academic_flashcards`
- `academic_flashcard_reviews`
- `academic_grading_scales`

### 2.2 Account Isolation
In Dexie, records are stored with scoped keys:
$$\text{ScopedKey} = \text{userId} + \text{":"} + \text{storageKey}$$
When switching accounts:
1. `clearMemoryCache()` wipes in-memory records.
2. `preloadCache(userId)` hydrates only records matching `userId`.
3. Unauthenticated `local` records are migrated cleanly upon sign-in.

---

## 3. Firestore Security Rules
Under `firestore.rules`:
```rules
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;

  match /appData/{document=**} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
}
```
This guarantees strict tenant isolation: users can only read and write their own academic documents.

