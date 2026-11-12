import { expect, test } from '@playwright/test';

test('table presents market, cities and readable card details on desktop and a phone', async ({ page }, info) => {
  const roomId = 'a'.repeat(32);
  await page.addInitScript(id => {
    localStorage.setItem(`machi-seat:${id}`, 'a'.repeat(64));
  }, roomId);
  let emit: () => void;
  const commands: { type: string; cardId?: string }[] = [];
  let strongerRival = false;
  await page.routeWebSocket(`**/api/rooms/${roomId}`, socket => {
    emit = () => socket.send(JSON.stringify({
      type: 'room', self: 'aki', hostId: 'aki',
      players: [{ id: 'aki', name: 'Aki', online: true, color: 0 }, { id: 'ren', name: 'Ren', online: true, color: 1 },
        { id: 'bo', name: 'Bo', online: true, color: 2 }],
      chat: [],
      game: {
        phase: 'opening', openingRound: 2, activePlayerId: 'aki',
        rollCoinChanges: strongerRival ? { aki: -2, ren: 3 } : undefined,
        supply: {
          low: { remaining: 27, stacks: [{ id: 'bakery', count: 3 }, { id: 'wheat-field', count: 1 }] },
          high: { remaining: 0, stacks: [] },
          landmarks: { remaining: 15, stacks: [{ id: 'radio-tower', count: 1 }, { id: 'observatory', count: 1 }] },
        },
        landmarkTriggers: strongerRival ? { 'farmers-market': Date.now() } : undefined,
        cities: [
          { id: 'aki', name: 'Aki', coins: 4, establishments: [{ id: 'wheat-field', count: 1 }], landmarks: [] },
          { id: 'bo', name: 'Bo', coins: 20, establishments: [], landmarks: strongerRival ? [{ id: 'radio-tower', count: 1 }, { id: 'temple', count: 1 }] : [] },
          { id: 'ren', name: 'Ren', coins: 4, establishments: ['bakery', 'vineyard', 'forest', 'cafe', 'wheat-field', 'mine'].map(id => ({ id, count: id === 'vineyard' ? 2 : 1 })), landmarks: [{ id: 'farmers-market', count: 1 }] },
        ],
        legalBuilds: { bakery: { cost: 1 }, 'wheat-field': { cost: 1 }, 'radio-tower': { cost: 12, blocked: 'Landmarks open after the initial building rounds.' }, observatory: { cost: 14 } },
      },
    }));
    socket.onMessage(message => {
      commands.push(JSON.parse(String(message)));
      emit();
    });
  });
  await page.goto(`/room/${roomId}`);
  await expect(page.getByRole('heading', { name: 'Opening round 2 of 3' }).first()).toBeVisible();
  const market = page.getByRole('region', { name: 'Market', exact: true });
  await expect(market.getByRole('group', { name: 'Bakery, 3 copies' })).toBeVisible();
  const leaderboard = page.getByRole('region', { name: 'Leaderboard overview' });
  const standings = leaderboard.getByRole('heading', { level: 3 });
  await expect(standings).toHaveText(['1. Ren', '2. Bo', '3. Aki (you)']);
  await expect(leaderboard.getByRole('group', { name: 'Wheat Field', exact: true }).first()).toBeVisible();
  await expect(leaderboard.getByRole('group', { name: 'Vineyard, 2 copies' })).toContainText('×2');
  const modifiers = page.getByRole('region', { name: 'Landmark modifiers' });
  await expect(modifiers.getByRole('group', { name: 'Radio Tower' })).toHaveCount(0);
  await modifiers.getByRole('group', { name: 'Farmers Market' }).hover();
  await expect(page.getByRole('region', { name: 'Farmers Market details' })).toContainText('Owned by Ren');
  await page.getByRole('heading', { name: 'Player order' }).hover();
  strongerRival = true;
  emit!();
  await expect(standings).toHaveText(['1. Bo', '2. Ren', '3. Aki (you)']);
  await expect(modifiers.locator('.modifier-pulse')).toBeVisible();
  const roster = page.locator('.roster');
  await expect(roster.getByLabel('Lost 2 coins this roll')).toHaveText('−2');
  await expect(roster.getByLabel('Gained 3 coins this roll')).toHaveText('+3');
  await expect(modifiers.getByRole('group', { name: 'Temple' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('table-desktop.png'), fullPage: true });
  const bank = page.getByRole('region', { name: 'Bank', exact: true });
  await expect(bank).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await bank.getByRole('group', { name: 'Bank', exact: true }).hover();
  const bankDetails = page.getByRole('region', { name: 'Bank details' });
  await expect(bankDetails).toContainText('Maintains the rules.');
  await expect(bankDetails).toHaveCSS('pointer-events', 'none');
  await page.getByRole('heading', { name: 'Market', exact: true }).hover();
  await expect(bankDetails).toBeHidden();
  const city = page.getByRole('region', { name: 'Player city' });
  const [marketBox, cityBox, bankBox, modifiersBox] = await Promise.all(
    [market, city, bank, modifiers].map(panel => panel.boundingBox()),
  );
  const sidebarGap = bankBox!.y - (modifiersBox!.y + modifiersBox!.height);
  expect(sidebarGap).toBeGreaterThan(0);
  expect(cityBox!.y - (marketBox!.y + marketBox!.height)).toBeCloseTo(sidebarGap);
  await expect(bank.locator('.bank-card')).toHaveCSS('background-color', 'rgb(245, 231, 208)');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(bank).toHaveCSS('background-color', 'rgb(36, 37, 39)');
  await expect(bank.locator('.bank-card')).toHaveCSS('background-color', 'rgb(23, 23, 25)');
  await expect(bank.locator('.bank-card')).toHaveCSS('border-top-color', 'rgb(255, 210, 48)');
  await page.screenshot({ path: info.outputPath('table-dark.png'), fullPage: true });
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await market.getByRole('group', { name: 'Bakery, 3 copies' }).hover();
  const details = page.getByRole('region', { name: 'Bakery details' });
  await expect(details.getByText('Activates on 2 or 3')).toBeVisible();
  await expect(details.getByRole('button', { name: 'Buy Bakery for 1 coin' })).toBeEnabled();
  await page.screenshot({ path: info.outputPath('expanded-card.png') });
  const wheat = market.getByRole('group', { name: 'Wheat Field', exact: true });
  const overlap = await details.evaluate(async (popup, adjacent) => {
    await Promise.all(popup.getAnimations().map(animation => animation.finished));
    const front = popup.getBoundingClientRect();
    const behind = adjacent.getBoundingClientRect();
    return { x: Math.min(front.right, behind.right) - 3, y: Math.max(front.top, behind.top) + 15,
      left: Math.max(front.left, behind.left), bottom: Math.min(front.bottom, behind.bottom) };
  }, (await wheat.elementHandle())!);
  expect(overlap.x).toBeGreaterThan(overlap.left);
  expect(overlap.y).toBeLessThan(overlap.bottom);
  await page.mouse.click(overlap.x, overlap.y);
  await expect(details).toBeVisible();
  await expect(page.getByRole('region', { name: 'Wheat Field details' })).toHaveCount(0);
  await details.getByRole('button', { name: 'Buy Bakery for 1 coin' }).click();
  await expect.poll(() => commands.some(command => command.type === 'build' && command.cardId === 'bakery')).toBe(true);
  await page.getByRole('heading', { name: 'Market', exact: true }).hover();
  await expect(details).toBeHidden();
  await wheat.hover();
  await expect(page.getByRole('region', { name: 'Wheat Field details' })).toBeVisible();
  await expect(details).toBeHidden();
  await page.keyboard.press('Escape');
  await market.getByRole('group', { name: 'Radio Tower, unaffordable' }).hover();
  const landmark = page.getByRole('region', { name: 'Radio Tower details' });
  await expect(landmark.getByText('12 / 16 / 22 ¢')).toBeVisible();
  await expect(landmark.locator('.card-meta')).toHaveText('12');
  await expect(market.getByRole('group', { name: 'Radio Tower, unaffordable' }).locator('.card-meta')).toHaveText('12');
  await expect(landmark.getByRole('button')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await market.getByRole('group', { name: 'Observatory, unaffordable' }).hover();
  const observatory = page.getByRole('region', { name: 'Observatory details' });
  await expect(observatory.getByLabel('Persistent effect')).toHaveText('∞');
  await expect(observatory.locator('.card-meta').getByLabel('14 coins')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'View Ren' }).click();
  await expect(page.getByRole('region', { name: 'Player city' }).getByRole('heading', { name: 'Ren’s city' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View Ren' })).toHaveAttribute('aria-pressed', 'true');
  const filters = city.getByRole('group', { name: 'Filter city properties' });
  await expect(filters.getByRole('button')).toHaveCount(10);
  const fruit = filters.getByRole('button', { name: 'Fruit', exact: true });
  await fruit.click();
  const vineyard = city.getByRole('group', { name: 'Vineyard, 2 copies' });
  await expect(vineyard).toBeVisible();
  await expect(city.locator('.table-card')).toHaveCount(1);
  await vineyard.hover();
  await expect(vineyard.getByText(/copies in the deck/)).toBeVisible();
  await expect(vineyard.getByText(/Coins this game: 0/)).toBeVisible();
  const textSize = await vineyard.locator('.card-inline-info > p').evaluate(node => getComputedStyle(node).fontSize);
  await expect(vineyard.getByText(/copies in the deck/)).toHaveCSS('font-size', textSize);
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
