import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Clear localStorage before each test for a clean state
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('app loads and shows the timer screen', async ({ page }) => {
  await expect(page.locator('#timer-screen')).toBeVisible();
  await expect(page.locator('#tap-btn')).toBeVisible();
});

test('tapping Start begins the timer', async ({ page }) => {
  await page.locator('#tap-btn').click();
  // Timer should be running — seconds element should be visible and ring animating
  await expect(page.locator('#timer-sec')).toBeVisible();
  // After a moment the timer is running; stop it
  await page.locator('#tap-btn').click();
  // Post-timer save panel should appear
  await expect(page.locator('#post-timer')).toBeVisible();
});

test('saving a session adds it to the log screen', async ({ page }) => {
  // Start and immediately stop
  await page.locator('#tap-btn').click();
  await page.waitForTimeout(500);
  await page.locator('#tap-btn').click();
  // Save the session
  await page.locator('#save-btn').click();
  // Switch to history screen and check a session-item exists
  await page.locator('#nav-history').click();
  await expect(page.locator('.session-item').first()).toBeVisible();
});

test('level switch changes the level badge text', async ({ page }) => {
  // Switch to settings to change level
  await page.locator('#nav-settings').click();
  await page.locator('#lvl-btn-2').click();
  // Go back to timer and check badge
  await page.locator('#nav-timer').click();
  await expect(page.locator('#lvl-text')).toContainText('Active Hang');
});

test('settings: incrementing a value updates the displayed number', async ({ page }) => {
  await page.locator('#nav-settings').click();
  const valEl = page.locator('#sv-delayStart');
  const before = parseInt(await valEl.innerText());
  // Click the + button next to delayStart
  await page.locator('button.adj-btn[onclick="adj(\'delayStart\',1)"]').click();
  const after = parseInt(await valEl.innerText());
  expect(after).toBe(before + 1);
});

test('heatmap renders a cell after a session is saved', async ({ page }) => {
  // Save two sessions so today's cell reaches minHangsPerDay (2) and gets class 'full'
  for (let i = 0; i < 2; i++) {
    await page.locator('#tap-btn').click();
    await page.waitForTimeout(300);
    await page.locator('#tap-btn').click();
    await page.locator('#save-btn').click();
  }
  await page.locator('#nav-history').click();
  // Today's heatmap cell should have class 'full' (or 'bonus' if > minHangsPerDay)
  const filled = page.locator('.heatmap-cell.full, .heatmap-cell.bonus');
  const count = await filled.count();
  expect(count).toBeGreaterThan(0);
});
