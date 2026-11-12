import { expect, test } from '@playwright/test';
import type { GameView } from '../src/game/view.ts';

test('special effect choices, congratulations and results use the game command protocol', async ({ page }, info) => {
  const roomId = 'b'.repeat(32);
  await page.addInitScript(id => localStorage.setItem(`machi-seat:${id}`, 'b'.repeat(64)), roomId);
  const game: GameView = {
    phase: 'choice', activePlayerId: 'aki', openingRound: 3, dice: [6], version: 23,
    choice: { kind: 'exchange', remaining: 1 }, winner: null, events: [],
    supply: { low: { remaining: 0, stacks: [] }, high: { remaining: 0, stacks: [] }, landmarks: { remaining: 0, stacks: [] } },
    cities: [
      { id: 'aki', name: 'Aki', coins: 5, establishments: [{ id: 'business-center', count: 1 }], landmarks: [] },
      { id: 'ren', name: 'Ren', coins: 5, establishments: [{ id: 'bakery', count: 2 }], landmarks: [] },
    ],
    legalBuilds: {},
    stats: { aki: { nudges: 729, stolen: 15, earned: 42, diceTotal: 18, diceCount: 5, rollCount: 3, thinking: 1208000, chats: 3, built: 4 } },
  };
  const commands: unknown[] = [];
  const controls = { revision: 0, replayReady: [] as string[], celebrations: [] as { id: number; count: number; at: number; sound: number }[] };
  await page.routeWebSocket(`**/api/rooms/${roomId}`, socket => {
    const emit = () => socket.send(JSON.stringify({
      type: 'room', self: 'aki', hostId: 'aki', chat: [],
      players: [{ id: 'aki', name: 'Aki', online: true }, { id: 'ren', name: 'Ren', online: true }], game, controls,
    }));
    socket.onMessage(message => {
      const command = JSON.parse(String(message));
      if (command.type === 'hello') return emit();
      commands.push(command);
      if (command.type === 'choose') game.version++;
      if (command.type === 'choose' && command.decision.kind === 'exchange') {
        game.choice = { kind: 'move', recipientId: 'ren' };
      } else if (command.type === 'choose') {
        game.choice = null;
        game.phase = 'finished';
        game.winner = 'aki';
      } else if (command.type === 'rematch') {
        controls.replayReady = ['aki'];
      } else if (command.type === 'congratulate') {
        const count = controls.celebrations.length + 1;
        controls.celebrations.push({ id: count, count, at: Date.now(), sound: 0 });
      }
      emit();
    });
  });
  await page.goto(`/room/${roomId}`);
  const effect = page.getByRole('region', { name: 'Resolve card effect' });
  await expect(effect.getByRole('heading', { name: 'Business Center' })).toBeVisible();
  await effect.getByLabel('Give').selectOption('business-center');
  await effect.getByLabel('Opponent').selectOption('ren');
  await effect.getByLabel('Take').selectOption('bakery');
  await page.screenshot({ path: info.outputPath('effect-exchange.png') });
  await effect.getByRole('button', { name: 'Exchange', exact: true }).click();
  await expect(effect.getByRole('heading', { name: 'Moving Company' })).toBeVisible();
  await expect(effect.getByRole('button', { name: 'Skip exchange' })).toHaveCount(0);
  await effect.getByLabel('Give').selectOption('business-center');
  await effect.getByRole('button', { name: 'Give card' }).click();
  await expect(page.getByRole('heading', { name: 'Game complete · Aki wins!' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Play again' })).toBeInViewport();
  await page.screenshot({ path: info.outputPath('victory-phone.png') });
  await page.getByLabel('Most annoying: 729 nudges', { exact: true }).hover();
  await expect(page.getByRole('tooltip')).toHaveText('Most annoying: 729 nudges');
  await page.getByRole('button', { name: 'Show detailed statistics' }).click();
  await expect(page.getByRole('heading', { name: 'Final leaderboard' })).toBeVisible();
  const statistics = page.getByRole('dialog', { name: 'Detailed statistics' });
  await expect(statistics.getByRole('row', { name: /Aki \(you\)/ })).toHaveAttribute('data-self', 'true');
  await expect(statistics.getByRole('columnheader')).toHaveCount(9);
  await expect(statistics.getByRole('button', { name: 'Total buildings' })).toBeVisible();
  const thinking = statistics.getByRole('button', { name: 'Thinking time' });
  const first = statistics.getByRole('row').nth(1);
  await thinking.click();
  await expect(first).toContainText('Aki (you)');
  await thinking.click();
  await expect(first).toContainText('Ren');
  await expect(statistics.getByRole('row', { name: /Aki \(you\)/ })).toHaveAttribute('data-self', 'true');
  await statistics.getByRole('button', { name: 'Player', exact: true }).click();
  await expect(first).toContainText('Aki (you)');
  expect(await statistics.evaluate(dialog => [dialog.scrollWidth - dialog.clientWidth, dialog.scrollHeight - dialog.clientHeight])).toEqual([0, 0]);
  await page.screenshot({ path: info.outputPath('statistics-phone.png') });
  await statistics.getByRole('button', { name: 'Close statistics' }).click();
  const sound = page.waitForResponse(response => response.url().endsWith('/confetti-pop-sound-effect.mp3') && response.ok());
  await page.getByRole('button', { name: 'Congratulate' }).click();
  await sound;
  await page.getByRole('button', { name: 'Congratulate' }).click();
  await expect(page.locator('.confetti-full[data-burst]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByRole('button', { name: 'Waiting...' })).toBeDisabled();
  expect(commands).toEqual([
    { type: 'choose', version: 23, decision: { kind: 'exchange', give: 'business-center', take: 'bakery', opponentId: 'ren' } },
    { type: 'choose', version: 24, decision: { kind: 'move', cardId: 'business-center' } },
    { type: 'congratulate', version: 25 },
    { type: 'congratulate', version: 25 },
    { type: 'rematch', version: 25 },
  ]);
});
