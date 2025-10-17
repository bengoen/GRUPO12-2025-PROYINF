// React Loan Simulator (realistic, bank-like) for HU001
;(function () {
  if (!window.React || !window.ReactDOM) return

  const e = React.createElement

  function formatCurrency(num, currency = 'CLP') {
    const opts = { style: 'currency', currency, maximumFractionDigits: currency === 'CLP' ? 0 : 2 }
    try { return new Intl.NumberFormat('es-CL', opts).format(num || 0) } catch { return `${Math.round(num || 0).toLocaleString('es-CL')} ${currency}` }
  }

  function annualRateFor(amount, termMonths) {
    // Realistic tiered annual nominal rate (TNA) in Chilean context
    let tna = 0.22 // base 22%
    if (amount >= 5_000_000) tna -= 0.03
    if (amount >= 10_000_000) tna -= 0.05
    if (termMonths <= 12) tna -= 0.02
    else if (termMonths >= 48) tna += 0.02
    // clamp between 10% and 35%
    return Math.max(0.10, Math.min(tna, 0.35))
  }

  function monthlyFromAnnualEffective(annual) { return Math.pow(1 + annual, 1 / 12) - 1 }

  function computeOffer({ amount, termMonths }) {
    const originationPct = 0.012 // 1.2% origen financiado
    const monthlyFee = 1500 // cargo fijo mensual
    const insuranceMonthlyPct = 0.00035 // 0.035% del saldo por mes

    const tna = annualRateFor(amount, termMonths)
    const monthlyRate = monthlyFromAnnualEffective(tna)

    const financedFee = amount * originationPct
    const principal = amount + financedFee // se financia la comisión

    const n = termMonths
    const r = monthlyRate
    const cuotaBase = r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n))

    // Construir cuadro de amortización (interés/amortización/seguro/total)
    let balance = principal
    const schedule = []
    for (let i = 1; i <= n; i++) {
      const interest = balance * r
      const amort = Math.max(0, cuotaBase - interest)
      const insurance = balance * insuranceMonthlyPct
      const total = cuotaBase + insurance + monthlyFee
      balance = Math.max(0, balance - amort)
      schedule.push({ i, interest, amort, insurance, fee: monthlyFee, total, balance })
    }

    // CAE (APR) aproximada con IRR de los flujos (cliente recibe amount, paga total mensual)
    const cashflows = [amount * 1.0 * +1] // t=0 ingreso para el cliente
    for (const row of schedule) cashflows.push(-row.total)
    const irrMonthly = irr(cashflows)
    const cae = irrMonthly != null ? Math.pow(1 + irrMonthly, 12) - 1 : null

    return {
      tna, monthlyRate, financedFee, principal, cuotaBase, monthlyFee, insuranceMonthlyPct,
      schedule, irrMonthly, cae,
      firstMonth: schedule[0],
      totals: schedule.reduce((acc, r) => {
        acc.totalPaid += r.total
        acc.totalInterest += r.interest
        acc.totalInsurance += r.insurance
        acc.totalFees += r.fee
        return acc
      }, { totalPaid: 0, totalInterest: 0, totalInsurance: 0, totalFees: 0 })
    }
  }

  function irr(cashflows) {
    // Robust bisection on [0, 1] monthly (0%..100%)
    function npv(rate) {
      let v = 0
      for (let t = 0; t < cashflows.length; t++) v += cashflows[t] / Math.pow(1 + rate, t)
      return v
    }
    let low = 0, high = 1
    let fLow = npv(low), fHigh = npv(high)
    // Expand high if no sign change
    let tries = 0
    while (fLow * fHigh > 0 && high < 5 && tries < 20) { high *= 1.5; fHigh = npv(high); tries++ }
    if (fLow * fHigh > 0) return null
    for (let i = 0; i < 80; i++) {
      const mid = (low + high) / 2
      const fMid = npv(mid)
      if (Math.abs(fMid) < 1e-6) return mid
      if (fLow * fMid < 0) { high = mid; fHigh = fMid } else { low = mid; fLow = fMid }
    }
    return (low + high) / 2
  }

  function LoanSimulator() {
    const [amount, setAmount] = React.useState(2_000_000)
    const [term, setTerm] = React.useState(24)
    const [showTable, setShowTable] = React.useState(false)
    const [busy, setBusy] = React.useState(false)
    const [result, setResult] = React.useState(null)
    const [message, setMessage] = React.useState(null)

    const offer = computeOffer({ amount: Number(amount) || 0, termMonths: Number(term) || 0 })

    async function confirm() {
      setBusy(true); setMessage(null)
      try {
        let applicantId = null
        try { applicantId = localStorage.getItem('applicantId') || null } catch(_) {}
        const res = await fetch('/api/loan-requests', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: Number(amount), termMonths: Number(term),
            monthlyRate: Number(offer.monthlyRate.toFixed(8)),
            monthlyPayment: Number(offer.firstMonth.total.toFixed(2)),
            applicantId: applicantId ? Number(applicantId) : null
          })
        })
        if (res.status === 401) {
          setMessage('Debes registrarte antes de confirmar. Ir a Registro.');
          setTimeout(() => { window.location.href = '/register' }, 1200)
          return
        }
        if (!res.ok) throw new Error('Error creando la solicitud')
        const json = await res.json()
        setResult(json)
        setMessage('Solicitud registrada. ¡Comenzaremos la evaluación!')
      } catch (err) { console.error(err); setMessage('No fue posible registrar la solicitud. Intenta de nuevo.') }
      finally { setBusy(false) }
    }

    function OptionCard({ title, m, t }) {
      const o = computeOffer({ amount: m, termMonths: t })
      return e('div', { className: 'offer-card' },
        e('h4', null, title),
        e('p', { className: 'offer-main' }, formatCurrency(o.firstMonth.total)),
        e('p', { className: 'offer-sub' }, `${t} meses • TNA ${(o.tna * 100).toFixed(1)}%`),
        e('button', { className: 'btn btn-secondary', onClick: () => { setAmount(m); setTerm(t); window.scrollTo({ top: document.getElementById('loan-simulator-root').offsetTop - 100, behavior: 'smooth' }) } }, 'Usar esta opción')
      )
    }

    return e('div', { className: 'simulator-card' },
      e('div', { className: 'simulator-grid' },
        e('div', { className: 'simulator-inputs' },
          e('label', { htmlFor: 'amount' }, 'Monto del préstamo'),
          e('input', { id: 'amount', type: 'range', min: 200000, max: 20000000, step: 50000, value: amount, onChange: ev => setAmount(Number(ev.target.value)) }),
          e('div', { className: 'input-inline' },
            e('input', { type: 'number', className: 'form-control', value: amount, min: 200000, max: 20000000, step: 50000, onChange: ev => setAmount(Number(ev.target.value)) }),
            e('span', { className: 'muted' }, 'CLP')
          ),
          e('label', { htmlFor: 'term' }, 'Plazo (meses)'),
          e('input', { id: 'term', type: 'range', min: 6, max: 60, step: 1, value: term, onChange: ev => setTerm(Number(ev.target.value)) }),
          e('div', { className: 'input-inline' },
            e('input', { type: 'number', className: 'form-control', value: term, min: 6, max: 60, step: 1, onChange: ev => setTerm(Number(ev.target.value)) }),
            e('span', { className: 'muted' }, 'meses')
          ),
          e('p', { className: 'muted mt-2' }, `TNA estimada ${(offer.tna * 100).toFixed(2)}% • Tasa mensual ${(offer.monthlyRate * 100).toFixed(2)}%`),
          e('p', { className: 'muted' }, `Comisión de apertura financiada: ${formatCurrency(offer.financedFee)}`)
        ),
        e('div', { className: 'simulator-summary' },
          e('h3', null, 'Resumen de Simulación'),
          e('ul', { className: 'summary-list' },
            e('li', null, e('span', null, 'Cuota base (sin seguros):'), e('strong', null, formatCurrency(offer.cuotaBase))),
            e('li', null, e('span', null, 'Seguro (mes 1 aprox.):'), e('strong', null, formatCurrency(offer.firstMonth.insurance))),
            e('li', null, e('span', null, 'Cargo fijo mensual:'), e('strong', null, formatCurrency(offer.monthlyFee))),
            e('li', { className: 'total' }, e('span', null, 'Pago mensual estimado:'), e('strong', null, formatCurrency(offer.firstMonth.total)))
          ),
          e('div', { className: 'totals' },
            e('p', null, e('span', null, 'Total a pagar:'), e('strong', null, formatCurrency(offer.totals.totalPaid))),
            e('p', null, e('span', null, 'Intereses totales:'), e('strong', null, formatCurrency(offer.totals.totalInterest))),
            e('p', null, e('span', null, 'Seguros + cargos:'), e('strong', null, formatCurrency(offer.totals.totalInsurance + offer.totals.totalFees)))
          ),
          e('p', { className: 'muted' }, offer.cae != null ? `CAE estimada ${(offer.cae * 100).toFixed(2)}%` : 'CAE no disponible'),
          e('div', { className: 'actions' },
            e('button', { className: 'btn btn-secondary', onClick: () => setShowTable(!showTable) }, showTable ? 'Ocultar tabla' : 'Ver tabla de amortización'),
            e('button', { className: 'btn btn-primary btn-large', onClick: confirm, disabled: busy }, busy ? 'Confirmando...' : 'Confirmar simulación')
          ),
          result && e('p', { className: 'text-success mt-2' }, `Solicitud #${result.id} creada (Pendiente)`),
          message && e('p', { className: 'mt-2' }, message)
        )
      ),
      e('div', { className: 'offer-cards' },
        e(OptionCard, { title: 'Pago rápido', m: amount, t: 12 }),
        e(OptionCard, { title: 'Balanceado', m: amount, t: 24 }),
        e(OptionCard, { title: 'Cuota más baja', m: amount, t: 48 }),
      ),
      showTable && e('div', { className: 'amort-table-wrapper' },
        e('table', { className: 'amort-table' },
          e('thead', null, e('tr', null,
            e('th', null, '#'), e('th', null, 'Interés'), e('th', null, 'Amortización'), e('th', null, 'Seguro'), e('th', null, 'Cargo'), e('th', null, 'Pago'), e('th', null, 'Saldo')
          )),
          e('tbody', null,
            offer.schedule.slice(0, 120).map(row => e('tr', { key: row.i },
              e('td', null, row.i),
              e('td', null, formatCurrency(row.interest)),
              e('td', null, formatCurrency(row.amort)),
              e('td', null, formatCurrency(row.insurance)),
              e('td', null, formatCurrency(row.fee)),
              e('td', null, formatCurrency(row.total)),
              e('td', null, formatCurrency(row.balance))
            ))
          )
        )
      )
    )
  }

  function mount() {
    const rootEl = document.getElementById('loan-simulator-root')
    if (!rootEl) return
    if (ReactDOM.createRoot) {
      const root = ReactDOM.createRoot(rootEl)
      root.render(e(LoanSimulator))
    } else {
      ReactDOM.render(e(LoanSimulator), rootEl)
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
  else mount()
})()
