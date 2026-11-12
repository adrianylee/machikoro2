interface Balance { coins: number }

export function credit(player: Balance, amount: number) {
  player.coins += amount;
  return amount;
}

export function debit(player: Balance, amount: number) {
  const paid = Math.min(player.coins, amount);
  player.coins -= paid;
  return paid;
}

export function transfer(payer: Balance, recipient: Balance, amount: number) {
  return credit(recipient, debit(payer, amount));
}

// Player seats are stored clockwise. Restaurants collect counterclockwise.
export function* counterclockwiseOpponents<T>(players: readonly T[], activeSeat: number) {
  for (let offset = 1; offset < players.length; offset++) {
    yield players[(activeSeat + players.length - offset) % players.length];
  }
}
