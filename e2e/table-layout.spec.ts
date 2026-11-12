import { expect, test } from '@playwright/test';

test('table presents market, cities and readable card details on desktop and a phone', async ({ page }, info) => {
  const roomId = 'a'.repeat(32);
  await page.addInitScript(id => {
    localStorage.setItem(`machi-seat:${id}`, 'a'.repeat(64));
  }, roomId);
  let emit: () => void;
  let strongerRival = false;
  await page.routeWebSocket(`**/api/rooms/${roomId}`, socket => {
    emit = () => socket.send(JSON.stringify({
      type: 'room', self: 'aki', hostId: 'aki',
      players: [{ id: 'aki', name: 'Aki', online: true, color: 0 }, { id: 'ren', name: 'Ren', online: true, color: 1 },
        { id: 'bo', name: 'Bo', online: true, color: 2 }],
      chat: [],
      game: {
        phase: 'opening', openingRound: 2, activePlayerId: 'aki',
        supply: {
          low: { remaining: 27, stacks: [{ id: 'bakery', count: 3 }, { id: 'wheat-field', count: 1 }] },
          high: { remaining: 0, stacks: [] },
          landmarks: { remaining: 15, stacks: [{ id: 'radio-tower', count: 1 }] },
        },
        landmarkTriggers: strongerRival ? { 'farmers-market': Date.now() } : undefined,
        cities: [
          { id: 'aki', name: 'Aki', coins: 4, establishments: [{ id: 'wheat-field', count: 1 }], landmarks: [] },
          { id: 'bo', name: 'Bo', coins: 20, establishments: [], landmarks: strongerRival ? [{ id: 'radio-tower', count: 1 }, { id: 'temple', count: 1 }] : [] },
          { id: 'ren', name: 'Ren', coins: 4, establishments: ['bakery', 'vineyard', 'forest', 'cafe', 'wheat-field', 'mine'].map(id => ({ id, count: id === 'vineyard' ? 2 : 1 })), landmarks: [{ id: 'farmers-market', count: 1 }] },
        ],
        legalBuilds: { bakery: { cost: 1 }, 'wheat-field': { cost: 1 }, 'radio-tower': { cost: 12, blocked: 'Landmarks open after the initial building rounds.' } },
      },
    }));
    socket.onMessage(emit);
  });
  await page.goto(`/room/${roomId}`);
  await expect(page.getByRole('heading', { name: 'Opening round 2 of 3' }).first()).toBeVisible();
  const market = page.getByRole('region', { name: 'Market' });
  await expect(market.getByRole('group', { name: 'Bakery, 3 copies' })).toBeVisible();
  const leaderboard = page.getByRole('region', { name: 'Leaderboard overview' });
  await expect(leaderboard.getByRole('heading', { level: 3 }).first()).toHaveText('1. Ren');
  await expect(leaderboard.getByRole('group', { name: 'Vineyard, 2 copies' })).toContainText('×2');
  const modifiers = page.getByRole('region', { name: 'Landmark modifiers' });
  await expect(modifiers.getByRole('group', { name: 'Radio Tower' })).toHaveCount(0);
  await modifiers.getByRole('group', { name: 'Farmers Market' }).hover();
  await expect(page.getByRole('region', { name: 'Farmers Market details' })).toContainText('Owned by Ren');
  strongerRival = true;
  emit!();
  await expect(leaderboard.getByRole('heading', { level: 3 }).first()).toHaveText('1. Bo');
  await expect(modifiers.locator('.modifier-pulse')).toBeVisible();
  await expect(modifiers.getByRole('group', { name: 'Temple' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('table-desktop.png'), fullPage: true });
  const bank = page.getByRole('region', { name: 'Bank' });
  await expect(bank).toHaveCSS('background-color', 'rgb(169, 225, 255)');
  await expect(bank.locator('.bank-card')).toHaveCSS('background-color', 'rgb(245, 231, 208)');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(bank).toHaveCSS('background-color', 'rgb(48, 50, 54)');
  await expect(bank.locator('.bank-card')).toHaveCSS('background-color', 'rgb(23, 23, 25)');
  await page.screenshot({ path: info.outputPath('table-dark.png'), fullPage: true });
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await market.getByRole('group', { name: 'Bakery, 3 copies' }).hover();
  const details = page.getByRole('region', { name: 'Bakery details' });
  await expect(details.getByText('Activates on 2 or 3')).toBeVisible();
  await expect(details.getByRole('button', { name: 'Buy Bakery for 1 coin' })).toBeEnabled();
  await page.screenshot({ path: info.outputPath('expanded-card.png') });
  await market.getByRole('group', { name: 'Bakery, 3 copies' }).click({ position: { x: 5, y: 5 } });
  await page.getByRole('heading', { name: 'Market', exact: true }).hover();
  await expect(details).toBeHidden();
  await market.getByRole('group', { name: 'Wheat Field', exact: true }).hover();
  await expect(page.getByRole('region', { name: 'Wheat Field details' })).toBeVisible();
  await expect(details).toBeHidden();
  await page.keyboard.press('Escape');
  await market.getByRole('group', { name: 'Radio Tower, unaffordable' }).hover();
  const landmark = page.getByRole('region', { name: 'Radio Tower details' });
  await expect(landmark.getByText('12 / 16 / 22 ¢')).toBeVisible();
  await expect(market.getByLabel('Single use on purchase')).toBeVisible();
  await expect(landmark.getByRole('button')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'View Ren' }).click();
  await expect(page.getByRole('region', { name: 'Player city' }).getByRole('heading', { name: 'Ren’s city' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View Ren' })).toHaveAttribute('aria-pressed', 'true');
  const city = page.getByRole('region', { name: 'Player city' });
  const filters = city.getByRole('group', { name: 'Filter city properties' });
  await expect(filters.getByRole('button')).toHaveCount(10);
  const fruit = filters.getByRole('button', { name: 'Fruit', exact: true });
  await fruit.click();
  const vineyard = city.getByRole('group', { name: 'Vineyard, 2 copies' });
  await expect(vineyard).toBeVisible();
  await expect(city.locator('.table-card')).toHaveCount(1);
  await vineyard.hover();
  await expect(vineyard.getByText(/copies in the deck/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Vineyard details' })).toHaveCount(0);
  const high = filters.getByRole('button', { name: 'Two dice', exact: true });
  await high.click();
  await expect(fruit).toHaveAttribute('aria-pressed', 'false');
  await expect(city.getByRole('group', { name: 'Mine', exact: true })).toBeVisible();
  await high.click();
  await expect(city.locator('.table-card')).toHaveCount(7);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('region', { name: 'Turn controls' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const cityCards = page.getByRole('region', { name: 'Player city' }).locator('.card-row');
  await cityCards.scrollIntoViewIfNeeded();
  await cityCards.hover();
  await page.mouse.wheel(0, 180);
  await expect.poll(() => cityCards.evaluate(row => row.scrollLeft)).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('table-phone.png') });
});
