import { expect, test } from '@playwright/test';

const profileId = 'jarbas';

const openApp = async (page) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Hybrid Fit/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '50 min' })).toBeVisible();
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
  await page.getByRole('button', { name: '50 min' }).click();
  await expect(page.getByText('Quick warm-up')).toBeVisible();
  await page.getByRole('button', { name: 'Warm-up done' }).click();
  await expect(page.getByText('Active session')).toBeVisible();

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
  expect(data.activeSession).toMatchObject({ durationMinutes: 50, warmupDone: true });
  expect(Object.values(data.setLog)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ weight: '24', rpe: '7', note: 'steady tempo' }),
    ]),
  );
});

test('exports JSON, rejects invalid imports, imports valid backups, and exports CSV logs', async ({ page }, testInfo) => {
  await openApp(page);
  await page.getByRole('button', { name: '30 min' }).click();
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
  await page.getByRole('button', { name: 'Import JSON' }).first().click();
  await expect(page.getByText('Import backup?')).toBeHidden();

  const [csvDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV' }).click(),
  ]);
  const csvPath = await csvDownload.path();
  const csv = await import('node:fs/promises').then((fs) => fs.readFile(csvPath, 'utf8'));
  expect(csv).toContain('"date","mode","duration","lowEnergy","day","exercise","set","weight","rpe","note"');
  expect(csv).toContain('"30"');
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
  await expect(page.getByRole('button', { name: '50 min' })).toBeVisible();
  await context.setOffline(false);
});

test('supports duration scaling, low energy, finish summary, and English-only execution copy', async ({ page }) => {
  await openApp(page);

  await page.getByRole('button', { name: '15 min' }).click();
  await page.getByRole('button', { name: 'Skip warm-up' }).click();
  await expect(page.getByText('Exercise', { exact: true })).toBeVisible();
  await expect(page.getByText('1/4').first()).toBeVisible();
  await expect(page.getByText('Set', { exact: true })).toBeVisible();
  await expect(page.getByText('0/1').first()).toBeVisible();
  await page.getByRole('button', { name: 'End session' }).click();
  await expect(page.getByText('Workout logged')).toBeVisible();

  await page.getByRole('button', { name: '30 min' }).click();
  await page.getByRole('button', { name: 'Warm-up done' }).click();
  await expect(page.getByText('0/2').first()).toBeVisible();
  await page.getByRole('button', { name: 'End session' }).click();

  await page.getByRole('button', { name: /Low energy session/ }).click();
  await expect(page.getByText('Quick warm-up')).toBeVisible();
  await expect(page.getByText('Calentamiento rápido')).toBeHidden();
  await expect(page.getByText('Aquecimento rápido')).toBeHidden();
  await expect(page.getByRole('button', { name: /\[(en|es|pt)\]/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Warm-up done' }).click();
  await expect(page.getByText('0/2').first()).toBeVisible();
  const data = await getProfileData(page);
  expect(data.activeSession).toMatchObject({ lowEnergy: true });
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

  await expect(page.getByRole('button', { name: '15 min' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Low energy session/i })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('iphone-15-pro-today.png'), fullPage: false });
});

test('keeps warm-up, sticky actions, rest timer, and compact nav separated on iPhone 15 Pro', async ({ page }, testInfo) => {
  await openApp(page);
  await page.getByRole('button', { name: '50 min' }).click();
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
