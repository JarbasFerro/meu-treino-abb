# **Hybrid Fit // Project Documentation and Architecture**

This document details the strategic, biomechanical, and technological foundations behind **Hybrid Fit**, a fitness Web App designed specifically for high executive performance.

## **1\. Context and User Profile**

The application was conceived not as a "generic fitness app", but as an energy and consistency management tool for a highly specific profile:

* **Profile:** Marketing Director, father of two small children (João and Beatriz).  
* **Base Location:** San Sebastián, Spain.  
* **Routine:** Highly fluctuating, with frequent corporate travel throughout Europe.  
* **Biotype:** 1.91m tall and 75kg. Lean body with long limbs (extensive levers).  
* **Strength Restrictions:** Reasonable base strength in the legs, but with a relative strength deficit in the arms and *core* (initial difficulty with conventional push-ups).  
* **Available Time:** Exactly 50 minutes daily, 7 days a week.

## **2\. Biomechanical Foundation of the Training**

The training structure was designed to fill the strength gaps of a tall and lean individual, considering the physics of their joint levers.

### **2.1. The Challenge of Long Levers**

Individuals at 1.91m need to move the weight over a much greater distance than shorter people. For the same load, the physical "Work" executed is greater.

* **Adopted Strategy (Supported Strength + Mobility):** The main focus of the application is to keep the 40-minute resistance/functional block precise while protecting the spine with supported bench positions, controlled eccentrics, and a daily 10-minute mobility cooldown.

### **2.2. Overload Adaptation (Push-ups)**

Due to the difficulty with floor push-ups (Bodyweight), the hotel protocol was adapted:

* Replacement of classic push-ups with **Incline Push-ups** (Hands on the bed) and **Knee Push-ups** (Knees on the floor).  
* **Objective:** Reduce the vectorial load on the chest and triceps by about 40%, allowing volume accumulation (12-15 repetitions) to generate hypertrophy and strength until the transition to the floor is possible.

### **2.3. The "Core" Factor**

For a man nearly 2 meters tall who spends hours on flights or in meetings, the lumbar region is critical. The app does not treat the *core* only with "floor crunches", but emphasizes planks, anti-rotation (Russian Twists), and passive stabilization during dumbbell movements.

## **3\. The "Hybrid" Ecosystem (Home vs. Hotel)**

The premise of **Hybrid Fit** is that consistency beats sporadic intensity. To ensure that training occurs 7 days a week, the interface was divided into two instantly switchable modes:

### **3.1. BASE Mode \[HOME\]**

* **Physical Setup:** Uses premium residential equipment: Bowflex 5.1s Adjustable Bench and Bowflex SelectTech 552i Dumbbells.  
* **Focus:** A 7-day plan sourced from `docs/Training Plan`: push, quad-focused legs, supported pull, active recovery/deep core, shoulders/arms/core, glute-ham legs, and Sunday recovery. Each session contains 40 minutes of targeted resistance or functional work plus 10 minutes of mobility.

### **3.2. FIELD Mode \[HOTEL\]**

* **Physical Setup:** No equipment (Bodyweight), using hotel furniture (bed, chair, wall, towels, luggage).  
* **Focus:** Bodyweight and travel-friendly equivalents that preserve the same daily focus, 50-minute structure, rest cadence, and mobility emphasis when bench and dumbbells are unavailable.

### **3.3. "Jet Lag" Mode**

A crucial interface feature. By pressing the \[JET LAG\] button, the application cuts the training volume (Sets) to a maximum of 2 per exercise. The psychological objective is to **"Maintain the Habit"**. Even when exhausted from an international flight, a 15-minute workout is better than zero.

## **4\. UI / UX Philosophy (Frontend Design)**

The design is organized around execution speed, mobile ergonomics, and beginner confidence.

### **4.1. Aesthetics: Daily Cockpit**

* **Concept:** The first active surface is a today-first cockpit with the current focus, completion percentage, completed sets, streak, next exercise, and fast actions for starting, switching to Hotel mode, or enabling Low Energy mode.  
* **Color Palette:** A warm paper base, dark text, and green action accent keep the interface calmer and easier to scan during training while preserving a distinct product identity.  
* **Typography:** Archivo carries the main interface with clear, compact headings. JetBrains Mono remains for technical labels, timer controls, and compact metrics.

### **4.2. Beginner Guidance**

Each exercise can expand into a guidance panel with:

* the specific exercise instruction from the training plan,  
* beginner cues,  
* common mistakes to avoid,  
* setup notes for home or hotel execution,  
* and a progression rule for either weighted or bodyweight movements.

## **5\. Technology Stack and Architecture**

The application was built as a single-page **SPA (Single Page Application)** with offline-friendly local persistence for resilience during network failures. It includes a web app manifest and a service worker so the app shell can be installed and cached for offline use.

### **5.1. Frontend**

* **Framework:** React 19 (via Vite in the deploy environment).  
* **Styling:** Tailwind CSS v4. All CSS, including animations and *hover* states, is generated via utility classes embedded directly into the components.  
* **State Management:** Local state generation via React's useState for interface control (Tabs, Modes, Timer, Checkboxes).

### **5.2. Sound System (Voice API & Web Audio)**

* To avoid the user needing to look at the screen to know the rest is over, the application implements window.speechSynthesis (Text-to-Speech) which reads the English alert.
* As a *fallback* (in case the browser blocks voice), a basic sound synthesizer was implemented via the Web Audio API (Oscillator generating a 440Hz Beep).  
* Sound is always enabled; the former quiet-mode control was removed to save header space.

### **5.3. Hybrid Backend (Offline-First)**

Data persistence (Set Progress, Consistency History, and *Progressive Overload* Weight Tracking) is managed with a local-first redundancy approach:

1. **Tier 1: IndexedDB (Local Source of Truth):** Workout state lives first in the `hybridFitDb` IndexedDB database. Profile data, active sessions, completed sets, weights, notes, RPE, personal records, and set logs are loaded and saved locally before any cloud backup is attempted. Existing legacy localStorage workout keys are migrated into IndexedDB without deleting the old keys.
2. **Tier 2: Firebase Firestore (Optional Backup):** When Vite Firebase environment variables are configured, the application uses anonymous authentication (signInAnonymously) and Firebase *WebSockets* (onSnapshot) for backup synchronization. Data is saved under the single Jarbas profile at /workout_profiles/jarbas/app_data/workout_data. Failed backup writes remain in a local IndexedDB outbox and retry while the app is open or comes back online.
3. **Preference Storage:** window.localStorage is intentionally limited to the Low Energy / Jet Lag mode preference and legacy compatibility values; workout state remains in IndexedDB.

### **5.4. Firebase Rules**

The Firestore security model is intentionally simple for a private app. Authentication is anonymous, and rules restrict reads and writes to the single expected `jarbas` profile document.

### **5.5. Analytical Engine (Heatmap)**

The interface has native JavaScript logic that computes the keys of the training state dictionary and cross-references them with the last 14 days of the Date() object. This generates the consistency *Heatmap* (similar to GitHub's) and calculates the current "Streak", using the premise that data gamification increases routine adherence.
