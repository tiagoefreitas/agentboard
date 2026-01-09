import { test, expect } from '@playwright/test'

test('dashboard loads and terminal attaches', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Agentboard' })).toBeVisible()

  await expect(page.getByTestId('column-working')).toBeVisible()
  await expect(page.getByTestId('column-needs_approval')).toBeVisible()
  await expect(page.getByTestId('column-waiting')).toBeVisible()
  await expect(page.getByTestId('column-idle')).toBeVisible()

  const card = page.getByTestId('session-card').first()
  await expect(card).toBeVisible()
  await card.click()

  await expect(page.getByTestId('terminal-panel')).toBeVisible()
  await expect(page.locator('.xterm')).toBeVisible()
})
