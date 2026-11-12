export function credit(player, amount) {
  player.coins += amount;
  return amount;
}

export function debit(player, amount) {
  const paid = Math.min(player.coins, amount);
  player.coins -= paid;
  return paid;
}

export function transfer(payer, recipient, amount) {
  return credit(recipient, debit(payer, amount));
}

// Player seats are stored clockwise. Restaurants collect counterclockwise.
export function* counterclockwiseOpponents(players, activeSeat) {
  for (let offset = 1; offset < players.length; offset++) {
    yield players[(activeSeat + players.length - offset) % players.length];
  }
}
