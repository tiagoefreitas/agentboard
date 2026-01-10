import { test, expect } from '@playwright/test'

test('dashboard loads and terminal attaches', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Agentboard' })).toBeVisible()

  const card = page.getByTestId('session-card').first()
  await expect(card).toBeVisible()
  await card.click()

  await expect(page.getByTestId('terminal-panel')).toBeVisible()
  await expect(page.locator('.xterm')).toBeVisible()
})
