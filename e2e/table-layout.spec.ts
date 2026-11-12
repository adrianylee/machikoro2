import { expect, test } from '@playwright/test';

test('table presents market, cities and readable card details on desktop and a phone', async ({ page }, info) => {
  const roomId = 'a'.repeat(32);
  await page.addInitScript(id => {
    localStorage.setItem(`machi-seat:${id}`, 'a'.repeat(64));
  }, roomId);
  const cards = {
    bakery: { id: 'bakery', name: 'Bakery', color: 'green', numbers: [2, 3], effect: 'On your turn, receive 2 coins from the bank.', art: '/art/bakery.webp' },
    wheat: { id: 'wheat', name: 'Wheat Field', color: 'blue', numbers: [1, 2], effect: 'On any turn, receive 1 coin from the bank.', art: '/art/wheat-field.webp' },
    tower: { id: 'tower', name: 'Radio Tower', color: 'landmark', numbers: [], effect: 'After building, take an extra turn.', art: '/art/radio-tower.webp' },
  };
  await page.routeWebSocket(`**/api/rooms/${roomId}`, socket => {
    socket.onMessage(() => socket.send(JSON.stringify({
      type: 'room', self: 'aki', hostId: 'aki',
      players: [{ id: 'aki', name: 'Aki', online: true }, { id: 'ren', name: 'Ren', online: true }],
      chat: [],
      game: {
        phase: 'opening', openingRound: 2, activePlayerId: 'aki',
        cards,
        supply: {
          low: { remaining: 27, stacks: [{ id: 'bakery', count: 3 }, { id: 'wheat', count: 1 }] },
          high: { remaining: 0, stacks: [] },
          landmarks: { remaining: 15, stacks: [{ id: 'tower', count: 1 }] },
        },
        cities: [
          { id: 'aki', name: 'Aki', coins: 4, establishments: [{ id: 'wheat', count: 1 }], landmarks: [] },
          { id: 'ren', name: 'Ren', coins: 4, establishments: [{ id: 'bakery', count: 1 }], landmarks: [] },
        ],
        legalBuilds: { bakery: { cost: 1 }, wheat: { cost: 1 }, tower: { cost: 12, blocked: 'Landmarks open after the initial building rounds.' } },
      },
    })));
  });
  await page.goto(`/room/${roomId}`);
  await expect(page.getByRole('heading', { name: 'Opening round 2 of 3' }).first()).toBeVisible();
  const market = page.getByRole('region', { name: 'Market' });
  await expect(market.getByRole('button', { name: 'Bakery, 3 copies' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('table-desktop.png'), fullPage: true });
  await market.getByRole('button', { name: 'Bakery, 3 copies' }).click();
  const details = page.getByRole('dialog', { name: 'Card details' });
  await expect(details.getByText('Activates on 2 or 3')).toBeVisible();
  await expect(details.getByRole('button', { name: 'Build', exact: true })).toBeEnabled();
  await page.keyboard.press('Escape');
  await market.getByRole('button', { name: 'Radio Tower' }).click();
  await expect(details.getByRole('button', { name: 'Build', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('region', { name: 'Turn controls' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: info.outputPath('table-phone.png') });
});
