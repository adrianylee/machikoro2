import { expect, test } from '@playwright/test';

test('a two-player lobby can throw a die, skip by majority, and end by draw vote', async ({ page, browser }, info) => {
  test.setTimeout(55_000);
  await page.goto('/');
  await page.getByLabel('Display name').fill('Aki');
  await page.getByRole('button', { name: 'Create game', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
  const guestContext = await browser.newContext();
  try {
    const guest = await guestContext.newPage();
    await guest.goto(page.url());
    await guest.getByLabel('Display name').fill('Ren');
    await guest.getByRole('button', { name: 'Join game', exact: true }).click();
    await expect(page.getByText('2 players connected')).toBeVisible();
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(guest.getByRole('heading', { name: 'Opening round 1 of 3' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Opening round 1 of 3' })).toBeVisible();
    const starting = await page.getByRole('button', { name: 'Pass', exact: true }).isVisible() ? page : guest;
    const second = starting === page ? guest : page;
    for (let round = 0; round < 3; round++) {
      await starting.getByRole('button', { name: 'Pass', exact: true }).click();
      await second.getByRole('button', { name: 'Pass', exact: true }).click();
    }
    await starting.getByRole('button', { name: 'Select one die' }).click();
    await expect(second.locator('.odds-table tr[data-selected]')).toHaveCount(2);
    const reference = second.getByRole('region', { name: 'Table references' });
    if (process.env.MACHIKORO_TEST_URL) {
      await reference.evaluate(element => {
        const steps: string[] = [];
        const readStep = () => {
          const step = element.querySelector<HTMLElement>('[aria-current="step"]')?.dataset.category;
          if (step && steps.at(-1) !== step) steps.push(step);
          (element as HTMLElement).dataset.observedSteps = steps.join(',');
        };
        new MutationObserver(readStep).observe(element, { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
        readStep();
      });
    }
    await starting.getByRole('button', { name: 'Click to throw die' }).click();
    const thrown = second.locator('.flying-die').first();
    await expect(thrown).toBeVisible();
    await expect.poll(() => thrown.evaluate(piece => {
      const movement = piece.getAnimations().map(animation => (animation.effect as KeyframeEffect).getKeyframes())
        .find(frames => frames[0]?.transform);
      const rotation = piece.querySelector('.die-cube')?.getAnimations()
        .map(animation => (animation.effect as KeyframeEffect).getKeyframes()).find(frames => frames[0]?.transform);
      return [movement, rotation].every(frames => frames &&
        new Set(frames.slice(0, 30).map(frame => frame.transform)).size > 10 &&
        new Set(frames.slice(-12).map(frame => frame.transform)).size === 1);
    })).toBe(true);
    await expect(second.locator('.phase-banner').getByLabel('Elapsed turn time')).toBeVisible();
    await expect(second.getByRole('heading', { name: 'Build', exact: true })).toBeVisible({ timeout: 23_000 });
    if (process.env.MACHIKORO_TEST_URL) {
      await expect(reference).toHaveAttribute('data-observed-steps', 'roll,red,blue,green,purple,landmarks,allowance,build');
    }
    await expect(second.locator('.dice-flight[data-settled] .die-flat')).toBeVisible({ timeout: 6500 });
    await expect(second.locator('.odds-table [data-hit]')).toHaveCount(2);

    const nudge = second.getByRole('button', { name: /^Nudge:/ });
    await nudge.click();
    await expect(nudge.locator('.nudge-counter')).toHaveText('×1');
    await nudge.click();
    await expect(starting.locator('.nudge-notice')).toHaveText(`${second === page ? 'Aki' : 'Ren'} nudged you`);
    await expect(nudge.locator('.nudge-counter')).toHaveText('×2');
    await expect(starting.locator('.nudge-counter')).toHaveCount(0);
    await second.getByRole('button', { name: 'Table Controls' }).click();
    await second.getByRole('button', { name: /^Vote to skip .+’s turn$/ }).click();
    await expect(starting.getByText('Skip turn vote', { exact: true })).toBeVisible();
    await expect(starting.getByRole('heading', { name: 'Build', exact: true })).toBeVisible();
    await starting.getByRole('button', { name: 'Yes', exact: true }).click();
    await expect(second.getByRole('button', { name: 'Click to throw die' })).toBeVisible();

    await second.getByRole('button', { name: 'Vote to draw game' }).click();
    await starting.getByRole('button', { name: 'Yes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Game drawn' })).toBeVisible();
    await expect(guest.getByRole('heading', { name: 'Game drawn' })).toBeVisible();
    await page.screenshot({ path: info.outputPath('draw-rankings.png') });
    await guest.getByRole('button', { name: 'Play again' }).click();
    await expect(guest.getByRole('button', { name: 'Waiting...' })).toBeDisabled();
    await expect(page.getByRole('heading', { name: 'Game drawn' })).toBeVisible();
    await page.getByRole('button', { name: 'Play again' }).click();
    await expect(guest.getByRole('heading', { name: 'Lobby' })).toBeVisible();
  } finally {
    await guestContext.close();
  }
});
