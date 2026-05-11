# **Hybrid Fit // Project Documentation and Architecture**

This document details the strategic, biomechanical, and technological foundations behind **Hybrid Fit**, a fitness Web App designed specifically for high executive performance.

## **1\. Context and User Profile**

The application was conceived not as a "generic fitness app", but as an energy and consistency management tool for a highly specific profile:

* **Profile:** Marketing Director, father of two small children (João and Beatriz).  
* **Base Location:** San Sebastián, Spain.  
* **Routine:** Highly fluctuating, with frequent corporate travel throughout Europe.  
* **Biotype:** 1.91m tall and 75kg. Lean body with long limbs (extensive levers).  
* **Strength Restrictions:** Reasonable base strength in the legs, but with a relative strength deficit in the arms and *core* (initial difficulty with conventional push-ups).  
* **Available Time:** Exactly 45 minutes daily, 7 days a week.

## **2\. Biomechanical Foundation of the Training**

The training structure was designed to fill the strength gaps of a tall and lean individual, considering the physics of their joint levers.

### **2.1. The Challenge of Long Levers**

Individuals at 1.91m need to move the weight over a much greater distance than shorter people. For the same load, the physical "Work" executed is greater.

* **Adopted Strategy (Time Under Tension):** The main focus of the application is to instruct the user to perform **slow descents (3 to 5 seconds)** instead of just focusing on the weight. The eccentric phase builds more base strength and protects the joints.

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
* **Focus:** Classic hypertrophy (10-12 repetitions). The quick adjustment via the dumbbell *dial* is assumed to maintain the strict 60-second rest.

### **3.2. FIELD Mode \[HOTEL\]**

* **Physical Setup:** No equipment (Bodyweight), using hotel furniture (bed, chair, wall, towels, luggage).  
* **Focus:** Metabolic tension and isometrics (Sets of up to 20 repetitions or until failure). Focuses on joint mobility to combat flight fatigue.

### **3.3. "Jet Lag" Mode**

A crucial interface feature. By pressing the \[JET LAG\] button, the application cuts the training volume (Sets) to a maximum of 2 per exercise. The psychological objective is to **"Maintain the Habit"**. Even when exhausted from an international flight, a 15-minute workout is better than zero.

## **4\. UI / UX Philosophy (Frontend Design)**

The design deliberately moves away from the "soft/friendly" aesthetics typical of B2C fitness apps (white backgrounds, rounded corners, soft gradients).

### **4.1. Aesthetics: Tactical Brutalism**

* **Concept:** The interface emulates an "Engineering Telemetry Panel" or a tactical military display. It is serious, dark, and focused solely on the task.  
* **Color Palette:** A nearly black Slate-900 background, violently contrasting with details in **Lime/Cyber Yellow (\#CCFF00)**. The neon yellow directs the eye straight to where action is needed (set buttons and timer).  
* **Typography:**  
  * Bebas Neue: For giant, compressed headers (visual impact).  
  * JetBrains Mono: For all data, timers, and set logs (reinforces the "system data" feel).  
* **Texture:** A base64 SVG (grain-overlay) with mix-blend-mode was injected, applying a static "noise" over the entire screen, giving it a physical hardware aesthetic instead of web software.

### **4.2. Friction Elimination (No-Icon Policy)**

SVG icon files (lucide-react) were replaced by **Monospaced Typography in brackets** (e.g., \[SWAP\], \[PLAY\], \[MUTE\]). This brings two benefits:

1. **Aesthetics:** Increases the "Cyberpunk/Terminal" feel.  
2. **Performance:** Eliminates the need to load external libraries, ensuring the Web App loads almost instantly, even on 3G from a remote airport.

## **5\. Technology Stack and Architecture**

The application was built as a single-page **SPA (Single Page Application)** with offline-friendly local persistence for resilience during network failures. It does not currently include a service worker or web app manifest.

### **5.1. Frontend**

* **Framework:** React 19 (via Vite in the deploy environment).  
* **Styling:** Tailwind CSS v4. All CSS, including animations and *hover* states, is generated via utility classes embedded directly into the components.  
* **State Management:** Local state generation via React's useState for interface control (Tabs, Modes, Timer, Checkboxes).

### **5.2. Sound System (Voice API & Web Audio)**

* To avoid the user needing to look at the screen to know the rest is over, the application implements window.speechSynthesis (Text-to-Speech) which reads the alert in the selected language.  
* As a *fallback* (in case the browser blocks voice), a basic sound synthesizer was implemented via the Web Audio API (Oscillator generating a 440Hz Beep).  
* The *Quiet Mode* tag (\[MUTE\]) completely silences this API.

### **5.3. Hybrid Backend (Offline-First)**

Data persistence (Set Progress, Consistency History, and *Progressive Overload* Weight Tracking) is managed with a dual redundancy approach:

1. **Tier 1: Firebase Firestore (Cloud):** When a Firebase configuration is injected into the runtime, the application uses anonymous authentication (signInAnonymously) and Firebase *WebSockets* (onSnapshot) for real-time synchronization. Data is saved in the cloud in the private artifacts collection (/artifacts/appId/users/userId/app\_data/workout\_data).  
2. **Tier 2: LocalStorage (Offline Fallback):**  
   The Web App keeps local copies of training state in window.localStorage. If Firebase is unavailable or not configured, it loads and saves data locally so workout tracking remains usable offline.

### **5.4. Analytical Engine (Heatmap)**

The interface has native JavaScript logic that computes the keys of the training state dictionary and cross-references them with the last 14 days of the Date() object. This generates the consistency *Heatmap* (similar to GitHub's) and calculates the current "Streak", using the premise that data gamification increases routine adherence.
