import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const INITIAL_MORTGAGE = 102888585;
const STORAGE_KEY = '@plan7030_history';
const MAX_DIGITS = 12;

// ───────────────────────── Utilidades ─────────────────────────
const withDots = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const formatCurrency = (amount) => '$' + withDots(Math.round(amount || 0));

// Mientras escribe: solo dígitos, mostrados como 1.500.000
const maskMoney = (text) => {
  const digits = text.replace(/\D/g, '').slice(0, MAX_DIGITS);
  return digits ? withDots(Number(digits)) : '';
};
const moneyToNumber = (text) => Number(text.replace(/\D/g, '')) || 0;

const MONTH_PREFIX = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTH_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Acepta: "Oct 2026", "octubre 2026", "octubre de 2026", "10/2026", "2026-10"
const parseMonth = (raw) => {
  const s = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ');

  let m = -1;
  let y = 0;
  let match = s.match(/^([a-z]{3,})(?: de)? (\d{4})$/);
  if (match) {
    m = MONTH_PREFIX.findIndex((p) => match[1].startsWith(p));
    y = Number(match[2]);
  } else if ((match = s.match(/^(\d{1,2})[/-](\d{4})$/))) {
    m = Number(match[1]) - 1;
    y = Number(match[2]);
  } else if ((match = s.match(/^(\d{4})[/-](\d{1,2})$/))) {
    y = Number(match[1]);
    m = Number(match[2]) - 1;
  }

  if (m < 0 || m > 11 || y < 2000 || y > 2100) return null;
  return { label: `${MONTH_LABEL[m]} ${y}` };
};

const validate = ({ month, mortgage, wedding }, history, remaining) => {
  const errors = {};

  if (!month.trim()) {
    errors.month = 'Ingresa el mes.';
  } else {
    const parsed = parseMonth(month);
    if (!parsed) {
      errors.month = 'Usa el formato "Oct 2026" o "10/2026".';
    } else if (history.some((h) => h.month.toLowerCase() === parsed.label.toLowerCase())) {
      errors.month = `Ya registraste ${parsed.label}.`;
    }
  }

  const mortgageValue = moneyToNumber(mortgage);
  if (!mortgage) {
    errors.mortgage = 'Ingresa el abono a capital.';
  } else if (mortgageValue <= 0) {
    errors.mortgage = 'El abono debe ser mayor a $0.';
  } else if (mortgageValue > remaining) {
    errors.mortgage =
      remaining === 0 ? 'La hipoteca ya está pagada.' : `Supera la deuda (${formatCurrency(remaining)}).`;
  }

  if (!wedding) {
    errors.wedding = 'Ingresa el ahorro (puede ser $0).';
  }

  return errors;
};

const loadHistory = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// ───────────────────────── Componentes ─────────────────────────
function Field({ label, error, ...inputProps }) {
  return (
    <div className="field">
      <label className="field-label">
        {label}
        <input className={`input${error ? ' input-error' : ''}`} {...inputProps} />
      </label>
      <div className="error-slot">{error && <span className="error-text">{error}</span>}</div>
    </div>
  );
}

function Donut({ paid, total }) {
  const size = 168;
  const stroke = 24;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = total > 0 ? Math.min(1, paid / total) : 0;
  const pct = (ratio * 100).toFixed(1).replace('.', ',') + '%';

  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`Hipoteca pagada: ${pct}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e74c3c" strokeWidth={stroke} />
        {ratio > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#2ecc71"
            strokeWidth={stroke}
            strokeDasharray={`${c * ratio} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <div className="donut-center">
        <span className="donut-pct">{pct}</span>
        <span className="donut-caption">pagado</span>
      </div>
    </div>
  );
}

function LegendRow({ color, name, amount }) {
  return (
    <div className="legend-row">
      <span className="legend-dot" style={{ background: color }} />
      <span className="legend-name">{name}</span>
      <span className="legend-amount">{formatCurrency(amount)}</span>
    </div>
  );
}

// ───────────────────────── App ─────────────────────────
export default function App() {
  const [month, setMonth] = useState('');
  const [mortgage, setMortgage] = useState('');
  const [wedding, setWedding] = useState('');
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const [history, setHistory] = useState(loadHistory);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (type, text) => {
    setToast({ type, text });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const totalMortgagePaid = history.reduce((s, i) => s + (i.mortgagePayment || 0), 0);
  const totalWeddingSaved = history.reduce((s, i) => s + (i.weddingSavings || 0), 0);
  const mortgageRemaining = Math.max(0, INITIAL_MORTGAGE - totalMortgagePaid);

  const errors = useMemo(
    () => validate({ month, mortgage, wedding }, history, mortgageRemaining),
    [month, mortgage, wedding, history, mortgageRemaining]
  );
  const visibleError = (field) => (touched[field] || submitted ? errors[field] : undefined);
  const touch = (field) => setTouched((t) => ({ ...t, [field]: true }));

  const persist = (next) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);

    if (Object.keys(errors).length > 0) {
      showToast('error', 'Revisa los campos marcados en rojo.');
      return;
    }

    const entry = {
      id: String(Date.now()),
      month: parseMonth(month).label,
      mortgagePayment: moneyToNumber(mortgage),
      weddingSavings: moneyToNumber(wedding),
      timestamp: Date.now(),
    };
    const next = [entry, ...history];

    if (!persist(next)) {
      showToast('error', 'No se pudo guardar. Revisa el almacenamiento del navegador.');
      return;
    }

    setHistory(next);
    setMonth('');
    setMortgage('');
    setWedding('');
    setTouched({});
    setSubmitted(false);
    showToast('success', 'Aporte guardado.');
  };

  const confirmDelete = (id) => {
    const next = history.filter((i) => i.id !== id);
    if (persist(next)) {
      setHistory(next);
      showToast('success', 'Mes eliminado. Los saldos se recalcularon.');
    } else {
      showToast('error', 'No se pudo eliminar el registro.');
    }
    setPendingDelete(null);
  };

  return (
    <div className="page">
      <main className="phone">
        <h1 className="title">Plan 70/30</h1>
        <p className="subtitle">Control de Hipoteca y Boda</p>

        <section className="dashboard">
          <div className="stat stat-mortgage">
            <span className="stat-label">Deuda restante</span>
            <span className="stat-value">{formatCurrency(mortgageRemaining)}</span>
          </div>
          <div className="stat stat-wedding">
            <span className="stat-label">Fondo boda</span>
            <span className="stat-value">{formatCurrency(totalWeddingSaved)}</span>
          </div>
        </section>

        <section className="panel">
          <h2 className="panel-title">Progreso de hipoteca</h2>
          <Donut paid={totalMortgagePaid} total={INITIAL_MORTGAGE} />
          <LegendRow color="#2ecc71" name="Pagado" amount={totalMortgagePaid} />
          <LegendRow color="#e74c3c" name="Deuda" amount={mortgageRemaining} />
        </section>

        <form className="panel" onSubmit={handleSubmit} noValidate>
          <h2 className="panel-title">Nuevo registro</h2>

          <Field
            label="Mes"
            placeholder="Ej. Oct 2026"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            onBlur={() => touch('month')}
            maxLength={20}
            autoComplete="off"
            error={visibleError('month')}
          />
          <Field
            label="Abono a capital ($)"
            placeholder="Ej. 1.500.000"
            value={mortgage}
            onChange={(e) => setMortgage(maskMoney(e.target.value))}
            onBlur={() => touch('mortgage')}
            inputMode="numeric"
            autoComplete="off"
            error={visibleError('mortgage')}
          />
          <Field
            label="Ahorro boda ($)"
            placeholder="Ej. 650.000"
            value={wedding}
            onChange={(e) => setWedding(maskMoney(e.target.value))}
            onBlur={() => touch('wedding')}
            inputMode="numeric"
            autoComplete="off"
            error={visibleError('wedding')}
          />

          <button type="submit" className="save-button">
            Guardar aporte
          </button>

          {toast && (
            <div className={`toast toast-${toast.type}`} role="status">
              {toast.text}
            </div>
          )}
        </form>

        <h2 className="section-title">Historial de aportes</h2>
        <div className="history">
          {history.length === 0 && (
            <p className="empty">Aún no hay aportes. Registra el primero arriba.</p>
          )}
          {history.map((item) => {
            const confirming = pendingDelete === item.id;
            return (
              <div className="history-row" key={item.id}>
                <div className="history-left">
                  <span className="history-month">{item.month}</span>
                  {confirming ? (
                    <div className="confirm-row">
                      <span className="confirm-text">¿Eliminar este mes?</span>
                      <button type="button" className="link link-danger" onClick={() => confirmDelete(item.id)}>
                        Sí, eliminar
                      </button>
                      <button type="button" className="link" onClick={() => setPendingDelete(null)}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="link link-danger" onClick={() => setPendingDelete(item.id)}>
                      Eliminar
                    </button>
                  )}
                </div>
                <div className="history-amounts">
                  <span className="history-mortgage">+{formatCurrency(item.mortgagePayment)}</span>
                  <span className="history-wedding">+{formatCurrency(item.weddingSavings)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}