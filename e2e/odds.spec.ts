import { expect, test } from '@playwright/test';
import type { GameView } from '../src/game/view.ts';

test('dice odds mark personal activations for the current roller and selected dice', async ({ page }) => {
  const roomId = 'c'.repeat(32);
  await page.addInitScript(id => localStorage.setItem(`machi-seat:${id}`, 'c'.repeat(64)), roomId);
  const game: GameView = {
    phase: 'roll', activePlayerId: 'ren', openingRound: 3, dice: null, version: 10, winner: null, choice: null, events: [],
    supply: { low: { remaining: 0, stacks: [] }, high: { remaining: 0, stacks: [] }, landmarks: { remaining: 0, stacks: [] } },
    cities: [
      { id: 'aki', name: 'Aki', coins: 5, landmarks: [], establishments: [
        { id: 'sushi-bar', count: 1 }, { id: 'bakery', count: 1 }, { id: 'forest', count: 2 },
        { id: 'corn-field', count: 1 }, { id: 'stadium', count: 1 },
      ] },
      { id: 'ren', name: 'Ren', coins: 5, landmarks: [], establishments: [] },
    ],
    legalBuilds: {},
  };
  let emit: () => void;
  await page.routeWebSocket(`**/api/rooms/${roomId}`, socket => {
    emit = () => socket.send(JSON.stringify({
      type: 'room', self: 'aki', hostId: 'aki', chat: [], game,
      players: [{ id: 'aki', name: 'Aki', online: true }, { id: 'ren', name: 'Ren', online: true }],
    }));
    socket.onMessage(emit);
  });
  await page.goto(`/room/${roomId}`);
  const low = page.getByRole('table', { name: 'Odds for rolls 1 to 6' });
  const high = page.getByRole('table', { name: 'Odds for rolls 7 to 12' });
  const cell = (dice: 1 | 2, roll: number) =>
    (roll <= 6 ? low : high).getByRole('row').nth(dice).locator('td').nth((roll - 1) % 6);
  const highlights = page.locator('.odds-table td[data-payout]');
  await expect(highlights).toHaveCount(2);
  await expect(cell(1, 1)).toHaveAttribute('data-payout', 'true');
  await expect(cell(1, 5)).toHaveAttribute('data-payout', 'true');
  await expect(cell(1, 7)).toHaveText('0%');
  await expect(cell(1, 7)).not.toHaveAttribute('data-payout', 'true');
  await cell(1, 5).hover();
  await expect(page.getByRole('tooltip')).toContainText('Forest');
  await expect(page.getByRole('tooltip')).toContainText('×2');

  game.diceSelection = 2;
  emit!();
  await expect(highlights).toHaveCount(2);
  await expect(cell(2, 1)).not.toHaveAttribute('data-payout', 'true');
  await cell(2, 5).hover();
  await expect(page.getByRole('tooltip')).toHaveAttribute('data-placement', 'above-both');
  await cell(2, 7).hover();
  await expect(page.getByRole('tooltip')).toHaveAttribute('data-placement', 'below');
  await expect(page.getByRole('tooltip')).toContainText('Corn Field');
  await expect(page.getByRole('tooltip')).not.toContainText('Stadium');

  game.activePlayerId = 'aki';
  emit!();
  await expect(highlights).toHaveCount(4);
  await expect(cell(2, 2)).toHaveAttribute('data-payout', 'true');
  await expect(page.getByRole('tooltip')).toContainText('Stadium');

  game.phase = 'resolve';
  game.resolutionStage = 'roll';
  game.dice = [3, 4];
  emit!();
  await expect(highlights).toHaveCount(0);
  await expect(page.locator('.odds-table [data-hit]')).toHaveCount(0);
  game.resolutionStage = 'red';
  emit!();
  await expect(high.getByRole('columnheader', { name: '7', exact: true })).toHaveAttribute('data-hit', 'true');
  await expect(cell(2, 7)).toHaveCSS('background-color', 'rgb(255, 210, 48)');
  await expect(cell(1, 7)).not.toHaveAttribute('data-hit', 'true');
});
