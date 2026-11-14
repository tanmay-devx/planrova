# Intelligent Spaced Repetition (Leitner 5-Box System)

## 1. Overview
The Spaced Repetition Engine (`shared/domain/academic/spaced-repetition.engine.js`) implements a deterministic 5-box Leitner scheduling system connecting flashcard memory decks with course syllabi and topics.

---

## 2. Leitner Box Intervals & Progression

| Box | Review Interval | Transition on `Again` | Transition on `Hard` | Transition on `Good` | Transition on `Easy` |
|---|---|---|---|---|---|
| **Box 1** | 1 day | Reset to Box 1 | Stay in Box 1 | Advance to Box 2 | Leap to Box 3 |
| **Box 2** | 2 days | Reset to Box 1 | Stay in Box 2 | Advance to Box 3 | Leap to Box 4 |
| **Box 3** | 4 days | Reset to Box 1 | Stay in Box 3 | Advance to Box 4 | Leap to Box 5 |
| **Box 4** | 7 days | Reset to Box 1 | Stay in Box 4 | Advance to Box 5 | Leap to Box 5 |
| **Box 5** | 14 days | Reset to Box 1 | Stay in Box 5 | Stay in Box 5 | Stay in Box 5 |

---

## 3. Rating Processing
When a student reviews a card, `processFlashcardReview` executes:
1. Calculates `nextBox`, `intervalDays`, and `nextReviewDate`.
2. Updates `reviewCount` ($+1$).
3. Updates `consecutiveCorrect`:
   - Increments on `good` or `easy`.
   - Resets to `0` on `again`.
4. Generates an immutable `reviewRecord` for analytics:
   ```javascript
   {
     id: "rev_1794649200_123",
     cardId: "card_456",
     deckId: "deck_cs101",
     rating: "good",
     previousBox: 2,
     newBox: 3,
     intervalDays: 4,
     timestamp: 1794649200000
   }
   ```

---

## 4. Review Queue Generation
`generateReviewQueue({ flashcards, deckId, courseId, referenceDateStr, maxCards })`:
- Filters cards due on or before `referenceDateStr`.
- Sorts by urgency:
  1. Box number ascending (Box 1 urgent recall first).
  2. Overdue days descending (oldest overdue first).

