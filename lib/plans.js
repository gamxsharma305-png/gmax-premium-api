/** Amounts in paise (Razorpay). */
const PLANS = [
  { id: 'monthly', amountPaise: 1900, days: 30, label: '₹19 / 1 month' },
  { id: 'bimonthly', amountPaise: 3900, days: 60, label: '₹39 / 2 months' },
];

function planFromAmount(amountPaise) {
  const n = Number(amountPaise);
  return PLANS.find((p) => p.amountPaise === n) || null;
}

module.exports = { PLANS, planFromAmount };
