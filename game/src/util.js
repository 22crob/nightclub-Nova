// Small shared helpers.

export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// Money as people write it: "$3,000".
export function formatMoney(n) {
  return `$${Math.floor(n).toLocaleString('en-US')}`;
}
