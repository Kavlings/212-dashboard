import { useEffect, useState } from "react";

type Kind = "all" | "trade" | "dividend" | "cash";

interface Transaction {
  id: number;
  kind: string;
  action: string | null;
  time: string | null;
  ticker: string | null;
  name: string | null;
  shares: number | null;
  price_per_share: number | null;
  total: number | null;
  total_currency: string | null;
  t212_id: string | null;
}

const KINDS: { value: Kind; label: string }[] = [
  { value: "all", label: "All" },
  { value: "trade", label: "Trades" },
  { value: "dividend", label: "Dividends" },
  { value: "cash", label: "Cash" },
];

const PAGE_SIZE = 30;

function fmt(val: number | null | undefined, decimals = 2) {
  if (val == null) return "—";
  return val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(val: string | null) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function TransactionsView() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<Kind>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    const url = kind === "all"
      ? "http://localhost:8000/transactions"
      : `http://localhost:8000/transactions?kind=${kind}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setTransactions(Array.isArray(data) ? data : []);
        setLoading(false);
        setPage(1);
      })
      .catch(() => setLoading(false));
  }, [kind]);

  const filtered = transactions.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (t.ticker ?? "").toLowerCase().includes(q) ||
      (t.name ?? "").toLowerCase().includes(q) ||
      (t.action ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const kindCounts: Record<string, number> = {};
  for (const t of transactions) {
    kindCounts[t.kind] = (kindCounts[t.kind] ?? 0) + 1;
  }

  if (loading) {
    return (
      <div className="transactions-view">
        <div className="tx-filter-bar">
          <div className="skeleton skeleton-tabs" />
          <div className="skeleton skeleton-search" />
        </div>
        <div className="glass-card">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton-row" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="skeleton skeleton-cell short" />
              <div className="skeleton skeleton-cell long" />
              <div className="skeleton skeleton-cell medium" />
              <div className="skeleton skeleton-cell medium" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="transactions-view">
      {/* Header */}
      <div className="tx-view-header">
        <div>
          <h2 className="tx-view-title">Transactions</h2>
          <p className="tx-view-subtitle">{filtered.length.toLocaleString()} records</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="tx-filter-bar">
        <div className="tx-kind-tabs">
          {KINDS.map((k) => (
            <button
              key={k.value}
              className={`tx-kind-tab${kind === k.value ? " active" : ""}`}
              onClick={() => { setKind(k.value); setPage(1); }}
            >
              {k.label}
              {k.value !== "all" && kindCounts[k.value] != null && (
                <span className="tx-kind-count">{kindCounts[k.value]}</span>
              )}
            </button>
          ))}
        </div>
        <input
          className="tx-search"
          type="text"
          placeholder="Search ticker or name…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="glass-card">
          <div className="chart-empty" style={{ height: 200 }}>
            {search ? "No results match your search." : "No transactions yet — import a CSV or sync via API."}
          </div>
        </div>
      ) : (
        <div className="dashboard-table-wrap glass-card">
          <table className="tx-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Date</th>
                <th>Ticker</th>
                <th>Name</th>
                <th>Action</th>
                <th className="num">Shares</th>
                <th className="num">Price</th>
                <th className="num">Total</th>
                <th>Currency</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((t) => (
                <tr key={t.id ?? t.t212_id}>
                  <td>
                    <span className={`kind-badge kind-${t.kind}`}>{t.kind}</span>
                  </td>
                  <td className="muted">{fmtDate(t.time)}</td>
                  <td className="ticker">{t.ticker || "—"}</td>
                  <td className="muted" style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.name || "—"}
                  </td>
                  <td className="muted">{t.action || "—"}</td>
                  <td className="num">{fmt(t.shares, 4)}</td>
                  <td className="num">{t.price_per_share != null ? fmt(t.price_per_share) : "—"}</td>
                  <td className={`num bold ${t.total != null ? (t.total >= 0 ? "green" : "red") : ""}`}>
                    {t.total != null ? `${t.total >= 0 ? "+" : ""}£${fmt(Math.abs(t.total))}` : "—"}
                  </td>
                  <td className="muted">{t.total_currency || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="tx-pagination">
          <button
            className="tx-page-btn"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Prev
          </button>
          <span className="tx-page-info">
            Page {page} of {totalPages}
          </span>
          <button
            className="tx-page-btn"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

export default TransactionsView;
