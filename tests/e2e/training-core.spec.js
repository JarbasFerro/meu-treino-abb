import { expect, test } from '@playwright/test';

const profileId = 'jarbas';

const selectProfile = async (page) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Jarbas/ }).click();
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

  await selectProfile(page);

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
  await selectProfile(page);
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
  await selectProfile(page);
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
  await selectProfile(page);
  await waitForServiceWorker(page);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: '50 min' })).toBeVisible();
  await context.setOffline(false);
});

test('supports duration scaling, low energy, finish summary, and translated execution copy', async ({ page }) => {
  await selectProfile(page);

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
  await page.getByRole('button', { name: '[en]' }).click();
  await expect(page.getByText('Calentamiento rápido')).toBeVisible();
  await page.getByRole('button', { name: '[es]' }).click();
  await expect(page.getByText('Aquecimento rápido')).toBeVisible();
  await page.getByRole('button', { name: '[pt]' }).click();
  await expect(page.getByText('Quick warm-up')).toBeVisible();
  await page.getByRole('button', { name: 'Warm-up done' }).click();
  await expect(page.getByText('0/2').first()).toBeVisible();
  const data = await getProfileData(page);
  expect(data.activeSession).toMatchObject({ lowEnergy: true });
});
