import { useEffect, useState, useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

interface Stats {
  total_invested: number;
  current_value: number;
  unrealized_pnl: number;
  realized_pnl: number;
  available_cash: number;
  total_dividends: number;
  total_fees: number;
  transaction_counts: Record<string, number>;
}

interface Position {
  ticker: string;
  name: string;
  isin: string;
  quantity: number | null;
  avg_price: number | null;
  current_price: number | null;
  current_value: number | null;
  total_cost: number | null;
  unrealized_pnl: number | null;
  fx_impact: number | null;
  currency: string | null;
}

interface CashFlowItem {
  month: string;
  invested: number;
  dividends: number;
}

interface Pie {
  id: number;
  name: string;
  goal: number | null;
  progress: number | null;
  status: "AHEAD" | "ON_TRACK" | "BEHIND" | null;
  cash: number | null;
  invested: number | null;
  current_value: number | null;
  pnl: number | null;
  pnl_pct: number | null;
  dividends_gained: number | null;
  dividends_reinvested: number | null;
}


const COLORS = ["#3b82f6","#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899","#6366f1","#94a3b8"];
const DIV_COLORS = [
  "#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#6366f1",
  "#84cc16","#f97316","#14b8a6","#a855f7","#eab308","#0ea5e9","#d946ef","#22c55e",
  "#fb923c","#38bdf8","#e879f9","#4ade80","#facc15","#60a5fa","#c084fc","#34d399",
];

function pnlClass(val: number | null | undefined) {
  if (val == null) return "";
  return val >= 0 ? "green" : "red";
}

function fmt(val: number | null | undefined, decimals = 2) {
  if (val == null) return "—";
  return val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function PortfolioView() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [pies, setPies] = useState<Pie[]>([]);
  const [cashflow, setCashflow] = useState<CashFlowItem[]>([]);
  const [divByTicker, setDivByTicker] = useState<Record<string, number | string>[]>([]);
  const [hoveredDiv, setHoveredDiv] = useState<{ ticker: string; month: string; value: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"all" | "ytd" | "1y" | "mtd" | "1m" | "1w" | "1d">("all");

  useEffect(() => {
    Promise.all([
      fetch("http://localhost:8000/stats").then((r) => r.json()),
      fetch("http://localhost:8000/portfolio/positions").then((r) => r.json()),
      fetch("http://localhost:8000/portfolio/pies").then((r) => r.json()),
      fetch("http://localhost:8000/portfolio/cashflow?granularity=daily").then((r) => r.json()),
      fetch("http://localhost:8000/portfolio/dividends/by-ticker").then((r) => r.json()),
    ]).then(([s, p, pi, c, dbt]) => {
      setStats(s);
      setPositions(p);
      setPies(pi);
      setCashflow(c);
      setDivByTicker(dbt);
      setLoading(false);
    });
  }, []);

  // Full cumulative data (all-time daily) — must be before early return
  const allCumulativeData = useMemo(() => {
    let cumInvested = 0, cumDividends = 0;
    return cashflow.map((d) => {
      cumInvested += d.invested;
      cumDividends += d.dividends;
      return { month: d.month, invested: Math.round(cumInvested * 100) / 100, dividends: Math.round(cumDividends * 100) / 100 };
    });
  }, [cashflow]);

  // Filter cumulative data to the selected period — must be before early return
  const cumulativeData = useMemo(() => {
    if (period === "all" || allCumulativeData.length === 0) return allCumulativeData;
    const now = new Date();
    let cutoff: Date;
    if (period === "ytd") cutoff = new Date(now.getFullYear(), 0, 1);
    else if (period === "1y") cutoff = new Date(now.getTime() - 365 * 86400000);
    else if (period === "mtd") cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === "1m") cutoff = new Date(now.getTime() - 30 * 86400000);
    else if (period === "1w") cutoff = new Date(now.getTime() - 7 * 86400000);
    else cutoff = new Date(now.getTime() - 86400000); // 1d
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return allCumulativeData.filter((d) => d.month >= cutoffStr);
  }, [allCumulativeData, period]);

  if (loading) return (
    <div className="portfolio-view">
      <div className="skeleton-grid">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="glass-card dash-stat-card" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="skeleton skeleton-label" />
            <div className="skeleton skeleton-value" />
          </div>
        ))}
      </div>
      <div className="glass-card chart-card skeleton-chart-card">
        <div className="skeleton skeleton-label" style={{ width: 160, marginBottom: "1.5rem" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 30, borderRadius: 6, opacity: 1 - i * 0.15, animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );

  const totalTx = Object.values(stats?.transaction_counts ?? {}).reduce((a, b) => a + b, 0);

  // Use live positions for the allocation chart; fall back to empty
  const allocationData = positions
    .filter((p) => p.current_value && p.current_value > 0)
    .slice(0, 8)
    .map((p) => ({ ticker: p.ticker || p.name, current_value: p.current_value }));
  const otherValue = positions.slice(8).reduce((s, p) => s + (p.current_value ?? 0), 0);
  if (otherValue > 0) allocationData.push({ ticker: "Other", current_value: otherValue });

  return (
    <div className="portfolio-view">
      <div className="portfolio-layout">
        <div className="portfolio-main">

      {/* Invested Chart — full width */}
      <div className="glass-card chart-card" style={{ marginBottom: "1.5rem" }}>
        <div className="chart-header">
          <p className="glass-card-title" style={{ marginBottom: 0 }}>Cumulative Invested</p>
          <div className="period-toggle">
            {(["all", "ytd", "1y", "mtd", "1m", "1w", "1d"] as const).map((p) => (
              <button
                key={p}
                className={`period-btn${period === p ? " active" : ""}`}
                onClick={() => setPeriod(p)}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {(() => {
          const last = cumulativeData[cumulativeData.length - 1]?.invested ?? 0;
          const first = cumulativeData[0]?.invested ?? 0;
          const change = last - first;
          const pct = first > 0 ? (change / first) * 100 : 0;
          const up = change >= 0;
          return (
            <div className="chart-value-block">
              <div className="chart-value-main">£{fmt(last)}</div>
              {cumulativeData.length > 1 && (
                <div className={`chart-value-change ${up ? "green" : "red"}`}>
                  {up ? "↑" : "↓"} {Math.abs(pct).toFixed(2)}% (£{fmt(Math.abs(change))})
                </div>
              )}
            </div>
          );
        })()}
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={cumulativeData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="month"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              interval={Math.max(0, Math.floor(cumulativeData.length / 8) - 1)}
              tickFormatter={(val: string) =>
                new Date(val + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })
              }
            />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} domain={period === "all" ? [0, "auto"] : ["auto", "auto"]} />
            <Tooltip
              formatter={(val) => [`£${Number(val).toFixed(2)}`, "Invested"]}
              contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
              labelStyle={{ color: "#94a3b8" }}
            />
            <Line type="monotone" dataKey="invested" name="Invested" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Charts Row — allocation donut + account breakdown + dividends */}
      <div className="charts-row">
        {/* Donut Chart — Allocation by Ticker */}
        <div className="glass-card chart-card">
          <p className="glass-card-title">Allocation</p>
          {allocationData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={allocationData}
                    dataKey="current_value"
                    nameKey="ticker"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                  >
                    {allocationData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => [`£${Number(val).toFixed(2)}`, "Value"]}
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-legend">
                {allocationData.map((item, i) => (
                  <div key={item.ticker} className="legend-item">
                    <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="legend-ticker">{item.ticker}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="chart-empty">Sync via API to see allocation</div>
          )}
        </div>

        {/* Dividends Chart */}
        <div className="glass-card chart-card">
          <p className="glass-card-title">Cumulative Dividends</p>
          {(() => {
            const last = cumulativeData[cumulativeData.length - 1]?.dividends ?? 0;
            const first = cumulativeData[0]?.dividends ?? 0;
            const change = last - first;
            const pct = first > 0 ? (change / first) * 100 : 0;
            const up = change >= 0;
            return (
              <div className="chart-value-block">
                <div className="chart-value-main">£{fmt(last)}</div>
                {cumulativeData.length > 1 && (
                  <div className={`chart-value-change ${up ? "green" : "red"}`}>
                    {up ? "↑" : "↓"} {Math.abs(pct).toFixed(2)}% (£{fmt(Math.abs(change))})
                  </div>
                )}
              </div>
            );
          })()}
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={cumulativeData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="month"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                interval={Math.max(0, Math.floor(cumulativeData.length / 8) - 1)}
                tickFormatter={(val: string) =>
                  new Date(val + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                }
              />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} domain={period === "all" ? [0, "auto"] : ["auto", "auto"]} />
              <Tooltip
                formatter={(val) => [`£${Number(val).toFixed(2)}`, "Dividends"]}
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                labelStyle={{ color: "#94a3b8" }}
              />
              <Line type="monotone" dataKey="dividends" name="Dividends" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie Performance Cards */}
      {pies.length > 0 && (
        <div className="glass-card" style={{ marginBottom: "1.5rem" }}>
          <p className="glass-card-title">Pies</p>
          <div className="pie-cards-grid">
            {pies.map((pie) => {
              const pct = pie.pnl_pct != null ? pie.pnl_pct * 100 : null;
              const progress = pie.progress != null ? Math.min(pie.progress, 1) : null;
              const statusColor = pie.status === "AHEAD" ? "#86efac" : pie.status === "BEHIND" ? "#fca5a5" : "#94a3b8";
              return (
                <div key={pie.id} className="pie-card">
                  <div className="pie-card-header">
                    <span className="pie-card-name">{pie.name}</span>
                    {pie.status && (
                      <span className="pie-card-status" style={{ color: statusColor }}>
                        {pie.status.replace("_", " ")}
                      </span>
                    )}
                  </div>

                  <div className="pie-card-value">£{fmt(pie.current_value)}</div>

                  <div className="pie-card-pnl-row">
                    <span className={pnlClass(pie.pnl)}>
                      {pie.pnl != null ? `${pie.pnl >= 0 ? "+" : ""}£${fmt(pie.pnl)}` : "—"}
                    </span>
                    <span className={`pie-card-pct ${pnlClass(pct)}`}>
                      {pct != null ? `${pct >= 0 ? "+" : ""}${fmt(pct)}%` : ""}
                    </span>
                  </div>

                  {pie.goal != null && progress != null && (
                    <div className="pie-card-goal">
                      <div className="pie-card-goal-label">
                        <span>Goal: £{fmt(pie.goal, 0)}</span>
                        <span>{Math.round(progress * 100)}%</span>
                      </div>
                      <div className="pie-progress-track">
                        <div
                          className="pie-progress-fill"
                          style={{ width: `${progress * 100}%`, background: statusColor }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="pie-card-meta">
                    <span>Invested £{fmt(pie.invested)}</span>
                    {pie.dividends_gained != null && pie.dividends_gained > 0 && (
                      <span className="green">+£{fmt(pie.dividends_gained)} div</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Holdings Table */}
      {positions.length > 0 && (
        <div className="dashboard-table-wrap glass-card">
          <p className="glass-card-title">Holdings</p>
          <table className="tx-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Name</th>
                <th>Qty</th>
                <th>Avg Price</th>
                <th>Current Price</th>
                <th>Value</th>
                <th>Unrealised P&L</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.ticker}>
                  <td className="ticker">{p.ticker || "—"}</td>
                  <td className="muted">{p.name || "—"}</td>
                  <td className="num">{fmt(p.quantity, 4)}</td>
                  <td className="num">{fmt(p.avg_price)}</td>
                  <td className="num">{fmt(p.current_price)}</td>
                  <td className="num bold">£{fmt(p.current_value)}</td>
                  <td className={`num bold ${pnlClass(p.unrealized_pnl)}`}>
                    {p.unrealized_pnl != null
                      ? `${p.unrealized_pnl >= 0 ? "+" : ""}£${fmt(p.unrealized_pnl)}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}


      {/* Dividends by Ticker Bar Chart */}
      {divByTicker.length > 0 && (() => {
        const allTickers = Array.from(
          new Set(divByTicker.flatMap((d) => Object.keys(d).filter((k) => k !== "month")))
        );
        const tickerColorMap = Object.fromEntries(allTickers.map((t, i) => [t, DIV_COLORS[i % DIV_COLORS.length]]));

        const CustomTooltip = ({ active, payload, label }: any) => {
          if (!active || !payload?.length || !hoveredDiv) return null;
          return (
            <div className="div-bar-tooltip">
              <div className="div-bar-tooltip-row"><span>Date</span><span>{label}</span></div>
              <div className="div-bar-tooltip-row"><span>Security</span><span>{hoveredDiv.ticker}</span></div>
              <div className="div-bar-tooltip-row"><span>Amount</span><span className="green">£{hoveredDiv.value.toFixed(4)}</span></div>
            </div>
          );
        };

        return (
          <div className="glass-card chart-card" style={{ marginBottom: "1.5rem" }}>
            <p className="glass-card-title">Dividends by Company</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={divByTicker} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickFormatter={(val: string) =>
                    new Date(val + "-01T00:00:00").toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
                  }
                />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                {allTickers.map((ticker) => (
                  <Bar
                    key={ticker}
                    dataKey={ticker}
                    stackId="a"
                    fill={tickerColorMap[ticker]}
                    onMouseEnter={(data: any) =>
                      setHoveredDiv({ ticker, month: data.month, value: data[ticker] ?? 0 })
                    }
                    onMouseLeave={() => setHoveredDiv(null)}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

        </div>{/* end portfolio-main */}

        {/* Portfolio Stats Sidebar */}
        <div className="portfolio-stats-sidebar">
          <div className="glass-card pstats-card">
            <p className="glass-card-title">Portfolio Stats</p>
            {stats && (
              <div className="pstats-total-return" style={{
                textAlign: "center",
                marginBottom: "1.25rem",
                padding: "1rem",
                borderRadius: 12,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: "0.4rem" }}>Total Return</div>
                <div style={{
                  fontSize: "1.8rem",
                  fontWeight: 700,
                  fontFamily: "'Playfair Display', serif",
                  color: stats.current_value >= stats.total_invested ? "#86efac" : "#fca5a5",
                }}>
                  {stats.total_invested > 0
                    ? `${stats.current_value >= stats.total_invested ? "+" : ""}${(((stats.current_value - stats.total_invested) / stats.total_invested) * 100).toFixed(2)}%`
                    : "—"
                  }
                </div>
                {stats.current_value > 0 && stats.total_invested > 0 && (
                  <div style={{ fontSize: "0.78rem", marginTop: "0.2rem", color: stats.current_value >= stats.total_invested ? "#86efac" : "#fca5a5", fontWeight: 600 }}>
                    {stats.current_value >= stats.total_invested ? "+" : "-"}£{fmt(Math.abs(stats.current_value - stats.total_invested))}
                  </div>
                )}
              </div>
            )}
            <div className="pstats-list">
              <div className="pstats-row">
                <span className="pstats-label">Cost Basis</span>
                <span className="pstats-value">£{fmt(stats?.total_invested)}</span>
              </div>
              <div className="pstats-row">
                <span className="pstats-label">Market Value</span>
                <span className="pstats-value">£{fmt(stats?.current_value)}</span>
              </div>
              <div className="pstats-row">
                <span className="pstats-label">Unrealised P&L</span>
                <span className={`pstats-value ${pnlClass(stats?.unrealized_pnl)}`}>
                  {stats?.unrealized_pnl != null
                    ? `${stats.unrealized_pnl >= 0 ? "+" : ""}£${fmt(stats.unrealized_pnl)}`
                    : "—"}
                </span>
              </div>
              <div className="pstats-row">
                <span className="pstats-label">Realised P&L</span>
                <span className={`pstats-value ${pnlClass(stats?.realized_pnl)}`}>
                  {stats?.realized_pnl != null
                    ? `${stats.realized_pnl >= 0 ? "+" : ""}£${fmt(stats.realized_pnl)}`
                    : "—"}
                </span>
              </div>
              <div className="pstats-row">
                <span className="pstats-label">Dividend Yield</span>
                <span className="pstats-value green">
                  {stats?.total_dividends != null && stats?.current_value
                    ? `% ${fmt((stats.total_dividends / stats.current_value) * 100)}`
                    : "—"}
                </span>
              </div>
              <div className="pstats-row">
                <span className="pstats-label">Divi. Yield on Cost</span>
                <span className="pstats-value green">
                  {stats?.total_dividends != null && stats?.total_invested
                    ? `% ${fmt((stats.total_dividends / stats.total_invested) * 100)}`
                    : "—"}
                </span>
              </div>
              <div className="pstats-row">
                <span className="pstats-label">Total Dividends</span>
                <span className="pstats-value green">£{fmt(stats?.total_dividends)}</span>
              </div>
              <div className="pstats-row">
                <span className="pstats-label">Monthly Dividend</span>
                <span className="pstats-value green">
                  {stats?.total_dividends != null && cashflow.length > 0
                    ? `£${fmt(stats.total_dividends / cashflow.length)}`
                    : "—"}
                </span>
              </div>
              <div className="pstats-row">
                <span className="pstats-label">Available Cash</span>
                <span className="pstats-value">£{fmt(stats?.available_cash)}</span>
              </div>
              <div className="pstats-row">
                <span className="pstats-label">Dividends Count</span>
                <span className="pstats-value">{(stats?.transaction_counts?.dividend ?? 0).toLocaleString()}</span>
              </div>
              <div className="pstats-row">
                <span className="pstats-label">Transactions Count</span>
                <span className="pstats-value">{totalTx.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

      </div>{/* end portfolio-layout */}
    </div>
  );
}

export default PortfolioView;
