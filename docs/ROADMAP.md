# Planrova 2.0 — Engineering Roadmap

```mermaid
flowchart LR
    P1["Phase 1: Foundation & Reliability<br/>(COMPLETED)"] --> P2["Phase 2: Unified Domain & Capture"]
    P2 --> P3["Phase 3: Adaptive Planning"]
    P3 --> P4["Phase 4: Academic Workspaces"]
    P4 --> P5["Phase 5: Finance & Wellbeing"]
    P5 --> P6["Phase 6: Hybrid AI Assistance"]
    P6 --> P7["Phase 7: Cross-Platform Maturation"]
    P7 --> P8["Phase 8: Production Scale & Security"]
```

---

## Phase 1: Foundation and Reliability (Completed)
- **Status:** **DONE**
- **Objectives:**
  - Audit and inventory existing web, mobile, server, and database codebases.
  - Implement durable offline synchronization queue with exponential backoff and jitter.
  - Eliminate record resurrection using deletion tombstones for collections.
  - Fix cross-account data leakage in IndexedDB on account switching.
  - Standardize monetary calculations using integer minor units.
  - Provide timezone-safe date parsing to eliminate UTC midnight day shifts.
  - Establish Vitest unit & integration test suites.
  - Create CI/CD workflow running test, build, and quality gates.
  - Provide strict Firestore security rules and backend proxy rate limiting.

---

## Phase 2: Unified Domain and Capture
- **Focus:** Ubiquitous input capture & shared domain abstractions.
- **Milestones:**
  - Universal Quick-Capture floating tray across web and mobile.
  - Shared validation package between React Native and Vanilla ES6 Web.
  - Bidirectional note-to-task linking graph.
  - Unified habit schema aligning web `streak` with mobile `fire`.

---

## Phase 3: Adaptive Planning
- **Focus:** Dynamic scheduling & workload intelligence.
- **Milestones:**
  - Conflict detection engine for overlapping lecture and study blocks.
  - Cognitive workload scoring (estimating mental fatigue per day).
  - Smart buffer recommendation before exam dates and assignment deadlines.
  - Automatic task rescheduling when items are missed.

---

## Phase 4: Academic and Professional Workspaces
- **Focus:** Multi-course management & exam readiness.
- **Milestones:**
  - Course workspaces with syllabus outlines, grading weights, and instructor contact cards.
  - Semester GPA calculator and academic target simulator.
  - Flashcard generator with Leitner spaced repetition interval scheduler.
  - Assignment dependency trees (research &rarr; outline &rarr; draft &rarr; peer review).

---

## Phase 5: Finance and Wellbeing
- **Focus:** Comprehensive personal resource tracking.
- **Milestones:**
  - Multi-wallet expense tracking (Cash, UPI, Bank Account).
  - Recurring student subscription audit (Spotify, GitHub, Netflix, Gym).
  - Sleep tracking integration with AlarmActivity wake-up statistics.
  - Screen-time and digital detox wind-down timer routines.

---

## Phase 6: Hybrid AI Assistance
- **Focus:** On-device privacy combined with cloud synthesis.
- **Milestones:**
  - On-device local LLM execution (WebGPU / ONNX Runtime) for zero-latency NLP task parsing.
  - Groq-powered weekly retrospective synthesis ("Week in Review" auto-summaries).
  - Autonomous syllabus ingestion: uploading PDF syllabi automatically populates the semester timetable.

---

## Phase 7: Cross-Platform Improvements
- **Focus:** Native device parity & ecosystem cohesion.
- **Milestones:**
  - Android Home Screen interactive widgets (Jetpack Compose / React Native Widget extension).
  - macOS & Windows desktop packaging via Electron or Tauri.
  - Full bidirectional offline synchronization between Mobile SQLite and Web IndexedDB.

---

## Phase 8: Production Readiness & Enterprise Security
- **Focus:** Scale, compliance, and multi-region availability.
- **Milestones:**
  - End-to-End Encryption (E2EE) for private notes using Web Crypto API.
  - Automated database backup snapshots and point-in-time recovery.
  - Penetration testing, SOC2 compliance preparation, and comprehensive telemetry.

