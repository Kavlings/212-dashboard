import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Cell,
} from "recharts";

interface CashFlowItem {
  month: string;
  invested: number;
  dividends: number;
}

function SpendingView() {
  const [cashflow, setCashflow] = useState<CashFlowItem[]>([]);
  const [divByTicker, setDivByTicker] = useState<Record<string, number | string>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("http://localhost:8000/portfolio/cashflow").then((r) => r.json()),
      fetch("http://localhost:8000/portfolio/dividends/by-ticker").then((r) => r.json()),
    ]).then(([cf, dbt]) => {
      setCashflow(cf);
      setDivByTicker(dbt);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="spending-view">
      <div className="skeleton-grid">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card dash-stat-card">
            <div className="skeleton skeleton-label" />
            <div className="skeleton skeleton-value" />
          </div>
        ))}
      </div>
      <div className="glass-card chart-card skeleton-chart-card" style={{ height: 400 }}>
        <div className="skeleton skeleton-label" style={{ width: 200, marginBottom: "2rem" }} />
        <div className="skeleton" style={{ height: "100%", width: "100%", opacity: 0.1 }} />
      </div>
    </div>
  );

  const totalInvested = cashflow.reduce((sum, m) => sum + m.invested, 0);
  const totalDividends = cashflow.reduce((sum, m) => sum + m.dividends, 0);
  const net = totalDividends - totalInvested;

  // Calculate Top Payers
  const tickerTotals: Record<string, number> = {};
  divByTicker.forEach((row) => {
    Object.entries(row).forEach(([key, val]) => {
      if (key !== "month" && typeof val === "number") {
        tickerTotals[key] = (tickerTotals[key] || 0) + val;
      }
    });
  });
  const topPayers = Object.entries(tickerTotals)
    .map(([ticker, amount]) => ({ ticker, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // Calculate Cumulative Growth
  let cumInvested = 0;
  let cumDividends = 0;
  const growthData = cashflow.map((m) => {
    cumInvested += m.invested;
    cumDividends += m.dividends;
    return {
      month: m.month,
      invested: cumInvested,
      dividends: cumDividends,
      ratio: cumInvested > 0 ? (cumDividends / cumInvested) * 100 : 0,
    };
  });

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  return (
    <div className="spending-view">
      {/* Summary Cards */}
      <div className="dashboard-stats">
        <div className="dash-stat-card">
          <div className="dash-stat-label">Total Deployed</div>
          <div className="dash-stat-value">£{totalInvested.toLocaleString()}</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-label">Income (Dividends)</div>
          <div className="dash-stat-value green">£{totalDividends.toFixed(2)}</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-label">Net Cash Flow</div>
          <div className={`dash-stat-value ${net >= 0 ? "green" : "red"}`}>
            £{net.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="spending-layout">
        <div className="spending-main">
          {/* Full-width Bar Chart */}
          <div className="glass-card chart-card">
            <p className="glass-card-title">Monthly Cash Flow</p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={cashflow} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                  labelStyle={{ color: "#94a3b8" }}
                  formatter={(val) => [`£${Number(val).toLocaleString()}`, ""]}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: "1rem", color: "#94a3b8", fontSize: 12 }} />
                <Bar dataKey="invested" name="Invested" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="dividends" name="Dividends" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="charts-row">
            {/* Top Payers */}
            <div className="glass-card chart-card">
              <p className="glass-card-title">Top Dividend Payers</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topPayers} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="ticker" type="category" tick={{ fill: "#94a3b8", fontSize: 11 }} width={60} />
                  <Tooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                    formatter={(val) => [`£${Number(val).toFixed(2)}`, "Total Dividends"]}
                  />
                  <Bar dataKey="amount" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20}>
                    {topPayers.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} opacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Growth Chart */}
            <div className="glass-card chart-card">
              <p className="glass-card-title">Cumulative Growth</p>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={growthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDiv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                    formatter={(val, name) => [`£${Number(val).toLocaleString()}`, name === "invested" ? "Total Invested" : "Total Dividends"]}
                  />
                  <Area type="monotone" dataKey="invested" stroke="#3b82f6" fill="transparent" strokeWidth={2} />
                  <Area type="monotone" dataKey="dividends" stroke="#10b981" fillOpacity={1} fill="url(#colorDiv)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SpendingView;
