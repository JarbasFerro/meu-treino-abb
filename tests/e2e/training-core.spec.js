import { expect, test } from '@playwright/test';

const profileId = 'jarbas';

const openApp = async (page) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Hybrid Fit/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Workout' })).toBeVisible();
};

const getProfileData = (page, id = profileId) => page.evaluate(async (selectedProfile) => {
  const request = indexedDB.open('hybridFitDb');
  const db = await new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  const tx = db.transaction('profileData', 'readonly');
  const store = tx.objectStore('profileData');
  const getRequest = store.get(selectedProfile);
  return new Promise((resolve, reject) => {
    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => resolve(getRequest.result);
  });
}, id);

const waitForServiceWorker = async (page) => {
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller || registration.active) return;
  });
};

const expectNoVerticalOverlap = (upperBox, lowerBox) => {
  expect(upperBox.y + upperBox.height).toBeLessThanOrEqual(lowerBox.y + 1);
};

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('migrates legacy localStorage into IndexedDB without deleting legacy data', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('abbWorkoutProgress', JSON.stringify({ '0-home-0-0': true }));
    localStorage.setItem('abbWeights', JSON.stringify({ '0-home-0': '22' }));
    localStorage.setItem('abbWorkoutHistory', JSON.stringify({ '2026-05-26': 1 }));
    localStorage.setItem('abbSwappedExercises', JSON.stringify({ '0-home-1': true }));
  });

  await openApp(page);

  await expect.poll(() => getProfileData(page)).toMatchObject({
    profileId,
    completedSets: { '0-home-0-0': true },
    weights: { '0-home-0': '22' },
    workoutHistory: { '2026-05-26': 1 },
    swappedExercises: { '0-home-1': true },
  });

  await page.reload();
  await expect.poll(() => getProfileData(page)).toMatchObject({
    completedSets: { '0-home-0-0': true },
    weights: { '0-home-0': '22' },
  });
  await expect(page.evaluate(() => localStorage.getItem('abbWorkoutProgress'))).resolves.toContain('0-home-0-0');
});

test('starts and resumes an active session with logged set details', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('today-load-hint')).toContainText('No load history yet');
  await page.getByRole('button', { name: 'Start Workout' }).click();
  await expect(page.getByText('Quick warm-up')).toBeVisible();
  await page.getByRole('button', { name: 'Warm-up done' }).click();
  await expect(page.getByText('Active session')).toBeVisible();
  await expect(page.getByTestId('session-load-hint')).toContainText('No load history yet');

  const loadInput = page.getByPlaceholder('Load').first();
  await loadInput.fill('24');
  await page.getByPlaceholder(/Adjustments/).fill('steady tempo');
  await page.locator('select').selectOption('7');
  await page.getByRole('button', { name: /Complete set/ }).click();

  await expect(page.getByText('Active session')).toBeVisible();
  await expect(page.getByText('PR', { exact: true })).toBeVisible();
  await expect(page.getByText('ACTIVE REST')).toBeVisible();
  await page.getByRole('button', { name: '+30' }).click();
  await page.getByRole('button', { name: /\[PAUSE\]/ }).click();
  await page.getByRole('button', { name: /\[X\]/ }).click();
  await expect(page.getByText('ACTIVE REST')).toBeHidden();
  await page.reload();
  await expect(page.getByText('Active session')).toBeVisible();
  await expect(page.getByPlaceholder('Load').first()).toHaveValue('24');

  const data = await getProfileData(page);
  expect(data.activeSession).toMatchObject({ durationMinutes: 45, warmupDone: true });
  expect(Object.values(data.setLog)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ weight: '24', rpe: '7', note: 'steady tempo' }),
    ]),
  );
});

test('shows display-only load hints from existing local history', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('abbWeights', JSON.stringify(
      Object.fromEntries(Array.from({ length: 7 }, (_, dayIndex) => [`${dayIndex}-home-0`, '22'])),
    ));
  });

  await openApp(page);
  await expect(page.getByTestId('today-load-hint')).toContainText('Use last load: 22');
  await expect(page.getByTestId('today-load-hint')).toContainText('Warm-up load');

  await page.getByRole('button', { name: 'Start Workout' }).click();
  await page.getByRole('button', { name: 'Skip warm-up' }).click();
  await expect(page.getByTestId('session-load-hint')).toContainText('Use last load: 22');
  await expect(page.getByPlaceholder('Load').first()).toHaveValue('22');
});

test('exports JSON, rejects invalid imports, imports valid backups, and exports CSV logs', async ({ page }, testInfo) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Start Workout' }).click();
  await page.getByRole('button', { name: 'Warm-up done' }).click();
  await page.getByPlaceholder('Load').first().fill('18');
  await page.getByPlaceholder(/Adjustments/).fill('backup test');
  await page.locator('select').selectOption('6');
  await page.getByRole('button', { name: /Complete set/ }).click();

  await page.getByRole('button', { name: /Progress/ }).click();
  const [jsonDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export JSON' }).click(),
  ]);
  const jsonPath = await jsonDownload.path();
  expect(jsonPath).toBeTruthy();

  const invalidPath = testInfo.outputPath('invalid-backup.json');
  await testInfo.attach('invalid-backup', { body: '{}', contentType: 'application/json' });
  await import('node:fs/promises').then((fs) => fs.writeFile(invalidPath, '{}'));
  await page.locator('#profile-import-file').setInputFiles(invalidPath);
  await expect(page.getByText(/Invalid backup/)).toBeVisible();

  await page.locator('#profile-import-file').setInputFiles(jsonPath);
  await expect(page.getByText('Import backup?')).toBeVisible();
  const importModalBox = await page.getByTestId('import-modal').boundingBox();
  const viewport = page.viewportSize();
  expect(importModalBox).toBeTruthy();
  expect(importModalBox.x).toBeGreaterThanOrEqual(0);
  expect(importModalBox.y).toBeGreaterThanOrEqual(0);
  expect(importModalBox.x + importModalBox.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(importModalBox.y + importModalBox.height).toBeLessThanOrEqual(viewport.height + 1);
  await page.getByRole('button', { name: 'Import JSON' }).first().click();
  await expect(page.getByText('Import backup?')).toBeHidden();

  const [csvDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV' }).click(),
  ]);
  const csvPath = await csvDownload.path();
  const csv = await import('node:fs/promises').then((fs) => fs.readFile(csvPath, 'utf8'));
  expect(csv).toContain('"date","mode","duration","lowEnergy","day","exercise","set","weight","rpe","note"');
  expect(csv).toContain('"45"');
  expect(csv).toContain('"false"');
  expect(csv).toContain('"18"');
  expect(csv).toContain('"6"');
  expect(csv).toContain('"backup test"');
});

test('keeps the PWA shell available on offline refresh', async ({ page, context }) => {
  await openApp(page);
  await waitForServiceWorker(page);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Start Workout' })).toBeVisible();
  await context.setOffline(false);
});

test('fits the compact iPhone 15 Pro Today shell', async ({ page }, testInfo) => {
  await openApp(page);

  const header = page.getByTestId('status-header');
  const nav = page.getByTestId('bottom-nav');
  await expect(header).toBeVisible();
  await expect(nav).toBeVisible();

  const headerBox = await header.boundingBox();
  const navBox = await nav.boundingBox();
  expect(headerBox).toBeTruthy();
  expect(navBox).toBeTruthy();
  expect(headerBox.y).toBeGreaterThanOrEqual(0);
  expect(headerBox.height).toBeLessThanOrEqual(72);
  expect(navBox.height).toBeLessThanOrEqual(56);

  const navButtons = await nav.getByRole('button').all();
  expect(navButtons).toHaveLength(3);
  for (const button of navButtons) {
    const box = await button.boundingBox();
    expect(box).toBeTruthy();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  await expect(page.getByRole('button', { name: 'Start Workout' })).toBeVisible();
  const startActionsBox = await page.getByTestId('today-start-actions').boundingBox();
  expect(startActionsBox).toBeTruthy();
  expect(startActionsBox.y + startActionsBox.height).toBeLessThanOrEqual(page.viewportSize().height * 0.58);
  await page.screenshot({ path: testInfo.outputPath('iphone-15-pro-today.png'), fullPage: false });
});

test('persists Hotel equipment choices and filters room-only swaps on iPhone 15 Pro', async ({ page }, testInfo) => {
  await openApp(page);
  await expect(page.getByTestId('hotel-equipment-panel')).toHaveCount(0);

  await page.getByRole('button', { name: 'Hotel' }).click();
  await expect(page.getByTestId('hotel-equipment-panel')).toBeVisible();
  await expect(page.getByTestId('hotel-equipment-panel')).toContainText('Room only');
  await expect(page.getByText('No bench, machines, pull-up bar, or heavy load assumed.')).toBeVisible();

  await page.getByRole('button', { name: '[INFO]' }).first().click();
  const swapOptions = page.getByTestId('swap-options').first();
  await expect(swapOptions).toBeVisible();
  await expect(swapOptions).toContainText('No equipment');
  await expect(swapOptions).toContainText('Original plan');
  await expect(swapOptions).not.toContainText('Band');

  await page.getByRole('button', { name: /Bands/ }).click();
  await expect(page.getByTestId('hotel-equipment-panel')).toContainText('Bands');
  await expect.poll(() => getProfileData(page)).toMatchObject({
    hotelEquipment: { bands: true, roomOnly: false, floorSpace: true },
  });

  await page.reload();
  await expect(page.getByRole('button', { name: 'Start Workout' })).toBeVisible();
  await page.getByRole('button', { name: 'Hotel' }).click();
  await expect(page.getByTestId('hotel-equipment-panel')).toContainText('Bands');

  const panelBox = await page.getByTestId('hotel-equipment-panel').boundingBox();
  const navBox = await page.getByTestId('bottom-nav').boundingBox();
  expect(panelBox).toBeTruthy();
  expect(navBox).toBeTruthy();
  expect(panelBox.x).toBeGreaterThanOrEqual(0);
  expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  await page.screenshot({ path: testInfo.outputPath('iphone-15-pro-hotel-equipment.png'), fullPage: false });

  await expect.poll(() => getProfileData(page)).toMatchObject({
    hotelEquipment: { bands: true, roomOnly: false, floorSpace: true },
  });
});

test('keeps warm-up, sticky actions, rest timer, and compact nav separated on iPhone 15 Pro', async ({ page }, testInfo) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Start Workout' }).click();
  await expect(page.getByText('Quick warm-up')).toBeVisible();

  const warmupActions = page.getByTestId('sticky-actions');
  const nav = page.getByTestId('bottom-nav');
  const warmupActionsBox = await warmupActions.boundingBox();
  const navBox = await nav.boundingBox();
  expect(warmupActionsBox).toBeTruthy();
  expect(navBox).toBeTruthy();
  expectNoVerticalOverlap(warmupActionsBox, navBox);
  await page.screenshot({ path: testInfo.outputPath('iphone-15-pro-warmup.png'), fullPage: false });

  await page.getByRole('button', { name: 'Warm-up done' }).click();
  await page.getByRole('button', { name: /Complete set/ }).click();
  await expect(page.getByTestId('rest-timer')).toBeVisible();

  const sessionActionsBox = await page.getByTestId('sticky-actions').boundingBox();
  const restTimerBox = await page.getByTestId('rest-timer').boundingBox();
  const compactNavBox = await nav.boundingBox();
  expect(sessionActionsBox).toBeTruthy();
  expect(restTimerBox).toBeTruthy();
  expect(compactNavBox).toBeTruthy();
  expectNoVerticalOverlap(restTimerBox, sessionActionsBox);
  expectNoVerticalOverlap(sessionActionsBox, compactNavBox);
  const actionButtonsFit = await page.getByTestId('sticky-actions').getByRole('button').evaluateAll((buttons) => (
    buttons.every((button) => button.scrollWidth <= button.clientWidth + 1 && button.scrollHeight <= button.clientHeight + 1)
  ));
  expect(actionButtonsFit).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('iphone-15-pro-session-rest.png'), fullPage: false });
});

test('keeps compact header and nav contained with simplified controls', async ({ page }) => {
  await openApp(page);

  await expect(page.getByTestId('status-header')).toBeVisible();
  await expect(page.getByTestId('bottom-nav')).toBeVisible();
  await expect(page.getByRole('button', { name: /\[(en|es|pt)\]/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /\[sound\]|\[mute\]/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Jarbas|Isabella/ })).toHaveCount(0);

  const viewport = page.viewportSize();
  const headerBox = await page.getByTestId('status-header').boundingBox();
  const navBox = await page.getByTestId('bottom-nav').boundingBox();
  expect(headerBox.x).toBeGreaterThanOrEqual(0);
  expect(navBox.x).toBeGreaterThanOrEqual(0);
  expect(headerBox.x + headerBox.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(navBox.x + navBox.width).toBeLessThanOrEqual(viewport.width + 1);
});

test('supports travel-week mode, dynamic warm-up loads, and per-exercise history drawers', async ({ page }) => {
  // Mock system Date to be a Monday (May 25, 2026)
  await page.addInitScript(() => {
    const mockDate = new Date('2026-05-25T10:00:00Z');
    const OriginalDate = Date;
    globalThis.Date = class extends OriginalDate {
      constructor(...args) {
        if (args.length === 0) {
          super(mockDate);
        } else {
          super(...args);
        }
      }
      static now() {
        return mockDate.getTime();
      }
    };
  });

  // 1. Test Travel-Week Mode toggle
  await openApp(page);
  await expect(page.getByTestId('travel-week-card')).toBeVisible();

  // Toggle ON
  await page.getByRole('button', { name: 'Travel-Week Mode' }).click();
  await expect(page.getByRole('button', { name: 'Travel-Week ON' })).toBeVisible();
  await expect(page.getByTestId('hotel-equipment-panel')).toBeVisible();
  await expect(page.getByTestId('hotel-equipment-panel')).toContainText('Hotel room only');

  // Verify in IndexedDB
  await expect.poll(() => getProfileData(page)).toMatchObject({
    travelWeekMode: true,
    sessionDuration: 45,
    hotelEquipment: { roomOnly: true },
  });

  // Toggle OFF
  await page.getByRole('button', { name: 'Travel-Week ON' }).click();
  await expect(page.getByRole('button', { name: 'Travel-Week Mode' })).toBeVisible();

  await expect.poll(() => getProfileData(page)).toMatchObject({
    travelWeekMode: false,
    sessionDuration: 45,
  });

  // 2. Test Dynamic Warm-Up load calculations
  await page.evaluate(async () => {
    const request = indexedDB.open('hybridFitDb');
    const db = await new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    const tx = db.transaction('profileData', 'readwrite');
    const store = tx.objectStore('profileData');
    const profile = await new Promise((resolve) => {
      store.get('jarbas').onsuccess = (e) => resolve(e.target.result);
    });
    // Set a load history for Monday Home Flat Bench DB Bench Press (day Index 0, home mode, exercise 0)
    profile.weights['0-home-0'] = '100 kg';
    profile.personalRecords['0-home-0'] = { bestLoad: 100, bestLoadAt: new Date().toISOString(), bestSetCount: 4 };
    await new Promise((resolve) => {
      store.put(profile).onsuccess = () => resolve();
    });
  });

  await page.reload();
  await openApp(page);

  // Check that the Today load hint displays dynamic warm-up load suggestions
  await expect(page.getByTestId('today-load-hint')).toContainText('Warm-up: 50% (50 kg), 70% (70 kg), 90% (90 kg)');

  // 3. Test opening the history drawer via "Last load" Metric
  await page.getByText('Last load', { exact: true }).click();
  await expect(page.getByTestId('history-drawer')).toBeVisible();
  await expect(page.getByTestId('history-drawer').getByRole('heading', { name: 'DB Bench Press' })).toBeVisible();
  await expect(page.getByTestId('history-drawer')).toContainText('100');
  await page.getByRole('button', { name: 'Close drawer' }).click();
  await expect(page.getByTestId('history-drawer')).toBeHidden();

  // 4. Test opening history drawer from Progress View
  await page.getByRole('button', { name: 'Progress' }).click();
  await expect(page.getByRole('heading', { name: 'Benchmarks & Lifts' })).toBeVisible();
  // Click 'DB Bench Press' benchmark lift card
  await page.getByRole('button', { name: 'DB Bench Press' }).click();
  await expect(page.getByTestId('history-drawer')).toBeVisible();
  await page.getByRole('button', { name: 'Close drawer' }).click();
  await expect(page.getByTestId('history-drawer')).toBeHidden();

  // 5. Test writing a new session log and completing it, to populate exercise history
  await page.getByRole('button', { name: 'Today' }).click();
  await page.getByRole('button', { name: 'Start Workout' }).click();
  await page.getByRole('button', { name: 'Warm-up done' }).click();

  // Update Weight, RPE, note
  const loadInput = page.getByPlaceholder('Load').first();
  await loadInput.fill('110 lbs');
  await page.getByPlaceholder(/Adjustments/).fill('solid push');
  await page.locator('select').selectOption('9');

  // Complete all 4 sets
  await page.getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: '4', exact: true }).click();

  // Complete session
  await page.getByRole('button', { name: 'End session' }).click();

  // Verify that the finish summary card displays detailed exercise logs
  await expect(page.getByTestId('finish-exercise-summary')).toBeVisible();
  await expect(page.getByTestId('finish-exercise-summary')).toContainText('DB Bench Press');
  await expect(page.getByTestId('finish-exercise-summary')).toContainText('4/4 sets');
  await expect(page.getByTestId('finish-exercise-summary')).toContainText('Load: 110 lbs');
  await expect(page.getByTestId('finish-exercise-summary')).toContainText('RPE: 9');
  await expect(page.getByTestId('finish-exercise-summary')).toContainText('solid push');

  await page.getByRole('button', { name: 'Back to today' }).click();
  await expect(page.getByTestId('finish-exercise-summary')).toBeHidden();

  // Verify that it populated exerciseHistory in IndexedDB
  await expect.poll(() => getProfileData(page)).toMatchObject({
    exerciseHistory: {
      'DB Bench Press': [
        expect.objectContaining({
          weight: '110 lbs',
          rpe: '9',
          note: 'solid push',
          completedSets: 4,
          totalSets: 4,
        }),
      ],
    },
  });

  // Open history drawer from Progress view and verify the completed log shows up
  await page.getByRole('button', { name: 'Progress' }).click();
  await page.getByRole('button', { name: 'DB Bench Press' }).click();
  await expect(page.getByTestId('history-drawer')).toBeVisible();
  await expect(page.getByTestId('history-drawer')).toContainText('110 lbs');
  await expect(page.getByTestId('history-drawer')).toContainText('solid push');
  await expect(page.getByTestId('history-drawer')).toContainText('4/4 sets');
  await page.getByRole('button', { name: 'Close drawer' }).click();

  // Go back to Today tab and turn on Travel-Week Mode to test Hotel cautions
  await page.getByRole('button', { name: 'Today' }).click();
  await page.getByRole('button', { name: 'Travel-Week Mode' }).click();
  await expect(page.getByRole('button', { name: 'Travel-Week ON' })).toBeVisible();

  // Go to Plan tab and open Tuesday's workout (index 1) to test Bulgarian Split Squats caution warning
  await page.getByRole('button', { name: 'Plan' }).click();
  await page.getByRole('button', { name: 'Tuesday' }).click();
  await page.getByRole('button', { name: 'Skip warm-up' }).click();

  // The first exercise on Tuesday is Bodyweight Squats (no caution)
  await expect(page.getByRole('heading', { name: 'Bodyweight Squats' })).toBeVisible();
  await expect(page.getByTestId('safety-caution-box')).toBeHidden();

  // Go to next exercise (Bulgarian Split Squats)
  await page.getByRole('button', { name: 'Next exercise' }).last().click();
  await expect(page.getByRole('heading', { name: 'Bulgarian Split Squats' })).toBeVisible();

  // Assert that safety caution box is visible and contains the warning
  await expect(page.getByTestId('safety-caution-box')).toBeVisible();
  await expect(page.getByTestId('safety-caution-box')).toContainText('Safety Caution');
  await expect(page.getByTestId('safety-caution-box')).toContainText(
    'Ensure the bed or chair is fully stable, non-slip, and can safely support your body weight before placing your foot.'
  );

  // Clean up by ending the session
  await page.getByRole('button', { name: 'End session' }).click();
});
