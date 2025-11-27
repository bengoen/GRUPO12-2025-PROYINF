// Utility functions to compute an installment schedule for a loan_request
// Mirrors the logic used by the React simulator (origination fee, monthly fee, insurance).

function buildInstallmentSchedule(loan) {
  if (!loan) return [];

  const amount = Number(loan.amount || 0);
  const termMonths = Number(loan.term_months || loan.term || 0);
  const monthlyRate = Number(loan.monthly_rate || 0);

  if (!amount || !termMonths) return [];

  const originationPct = 0.012; // 1.2% financed commission
  const monthlyFee = 1500; // fixed monthly fee
  const insuranceMonthlyPct = 0.00035; // 0.035% of outstanding balance per month

  const financedFee = amount * originationPct;
  const principal = amount + financedFee;

  const n = termMonths;
  const r = monthlyRate;
  const cuotaBase = n > 0
    ? (r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n)))
    : 0;

  let balance = principal;
  const schedule = [];

  const startDate = loan.created_at ? new Date(loan.created_at) : new Date();

  for (let i = 1; i <= n; i++) {
    const interest = balance * r;
    const amort = Math.max(0, cuotaBase - interest);
    const insurance = balance * insuranceMonthlyPct;
    const totalPayment = cuotaBase + insurance + monthlyFee;
    balance = Math.max(0, balance - amort);

    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    schedule.push({
      installment: i,
      dueDate: dueDate.toISOString(),
      interest,
      amortization: amort,
      insurance,
      fee: monthlyFee,
      totalPayment,
      remainingBalance: balance
    });
  }

  return schedule;
}

function summarizeSchedule(schedule) {
  return (schedule || []).reduce(
    (acc, row) => {
      acc.totalPaid += row.totalPayment || 0;
      acc.totalInterest += row.interest || 0;
      acc.totalInsurance += row.insurance || 0;
      acc.totalFees += row.fee || 0;
      return acc;
    },
    { totalPaid: 0, totalInterest: 0, totalInsurance: 0, totalFees: 0 }
  );
}

module.exports = {
  buildInstallmentSchedule,
  summarizeSchedule
};

