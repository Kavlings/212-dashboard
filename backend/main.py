from backend.csv_parser import parse_trading212_csv
from backend.database import SessionLocal
from backend.models import Transaction
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Any, Optional
from collections import defaultdict
import httpx
import base64
import asyncio
import time
import json
import os
from pydantic import BaseModel

CACHE_PATH = os.path.join(os.path.dirname(__file__), "sync_cache.json")

def read_cache() -> dict:
    try:
        with open(CACHE_PATH) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def write_cache(data: dict) -> None:
    with open(CACHE_PATH, "w") as f:
        json.dump(data, f)


class ApiSyncRequest(BaseModel):
    api_key: str
    api_secret: str = ""
    account_type: str = "live"    # "live" or "demo"
    product_type: str = "invest"  # "invest" | "stocks-isa" | "cfd" | "cash-isa"


def strip_ticker_suffix(raw: str) -> str:
    return raw.split("_")[0] if raw else raw


async def fetch_all_pages(client: httpx.AsyncClient, url: str) -> list[dict]:
    from urllib.parse import urlparse, urljoin, urlunparse
    items = []
    while url:
        parsed = urlparse(url)
        base_host = f"{parsed.scheme}://{parsed.netloc}"
        path_only = urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))
        for attempt in range(4):
            resp = await client.get(url)
            rate_limit = resp.headers.get("x-ratelimit-remaining")
            rate_reset = resp.headers.get("x-ratelimit-reset")

            if rate_limit is not None and int(rate_limit) < 5:  # Low on requests
                wait_time = int(rate_reset or 0) - int(time.time())
                if wait_time > 0:
                    await asyncio.sleep(wait_time)
            if resp.status_code == 429:
                wait = 15 * (attempt + 1)
                await asyncio.sleep(wait)
            if resp.status_code == 404:
                return items  # cursor expired or no more pages
            resp.raise_for_status()
            break
        else:
            resp.raise_for_status()
        body = resp.json()
        items.extend(body.get("items", []))
        next_path = body.get("nextPagePath")
        if next_path:
            if next_path.startswith("http"):
                url = next_path
            elif next_path.startswith("/"):
                url = urljoin(base_host, next_path)
            else:
                # bare query string e.g. "limit=20&cursor=..."
                url = f"{path_only}?{next_path}"
        else:
            url = None
    return items


def map_order(o: dict) -> dict:
    # API returns { "order": {...}, "fill": {...} }
    order = o.get("order") or o
    fill = o.get("fill") or {}
    side = order.get("side", "")
    order_type = order.get("type", "")  # MARKET, LIMIT, STOP, STOP_LIMIT
    is_buy = side.upper() == "BUY"
    fill_price = fill.get("price")
    filled_qty = fill.get("quantity") or order.get("filledQuantity")
    filled_value = order.get("filledValue") or (
        round(fill_price * filled_qty, 6) if fill_price and filled_qty else 0
    ) or 0
    inst = order.get("instrument") or {}
    action = f"{order_type.title()} {'Buy' if is_buy else 'Sell'}" if order_type and side else "Trade"
    return {
        "kind": "trade",
        "action": action,
        "time": order.get("createdAt") or fill.get("filledAt"),
        "ticker": strip_ticker_suffix(order.get("ticker", "")),
        "isin": inst.get("isin"),
        "name": inst.get("name"),
        "shares": filled_qty,
        "price_per_share": fill_price or (round(filled_value / filled_qty, 6) if filled_qty else None),
        "total": -filled_value if is_buy else filled_value,
        "total_currency": order.get("currency") or (fill.get("walletImpact") or {}).get("currency"),
        "t212_id": str(order.get("id")) if order.get("id") else None,
    }


def map_dividend(d: dict) -> dict:
    inst = d.get("instrument") or {}
    return {
        "kind": "dividend",
        "time": d.get("paidOn"),
        "ticker": strip_ticker_suffix(d.get("ticker", "")),
        "name": inst.get("name"),
        "shares": d.get("quantity"),
        "price_per_share": d.get("grossAmountPerShare"),
        "total": d.get("amount"),
        "total_currency": d.get("currency"),
        "t212_id": d.get("reference"),
    }


def map_cash(c: dict) -> dict:
    tx_type = c.get("type", "")
    raw = c.get("amount", 0) or 0
    amount = -abs(raw) if tx_type.upper() == "WITHDRAW" else abs(raw)
    return {
        "kind": "cash",
        "action": tx_type.title(),
        "time": c.get("dateTime"),
        "total": amount,
        "total_currency": c.get("currency"),
        "t212_id": c.get("reference"),
    }

app = FastAPI(title="212 Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], #Vite dev server origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check() -> dict[str, str]:
    # Endpoint to confirm backend's running
    return {"status":"ok"}

@app.post("/upload")
async def upload_csv(file:UploadFile = File(...)) -> Any:

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    try:
        parsed = parse_trading212_csv(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parsing failed: {str(e)}")

    # and nowww we add to the database
    db = SessionLocal()
    try:
        for t in parsed["transactions"]:
            if t.get("parse_error"):
                continue  # Skip rows with errors to avoid DB pollution
            t212_id = t.get("id")
            if t212_id and db.query(Transaction).filter(Transaction.t212_id == t212_id).first():
                continue  # already exists, skip
            t_data = {k:v for k, v in t.items() if k != 'id'}
            t_data["t212_id"] = t212_id
            db.add(Transaction(**t_data))
        db.commit()
    except Exception as e: 
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        db.close()

    return JSONResponse({
        "filename": file.filename,
        "size_bytes": len(content),
        "parsed": parsed
    })


@app.get("/transactions")
def get_transactions(kind: Optional[str] = Query(None)) -> Any:
    db = SessionLocal()
    try:
        query = db.query(Transaction)
        if kind:
            query = query.filter(Transaction.kind == kind)
        rows = query.order_by(Transaction.time.desc()).all()
        return [
            {c.name: getattr(row, c.name) for c in Transaction.__table__.columns}
            for row in rows
        ]
    finally:
            db.close()

@app.get("/stats")
def get_stats() -> Any:
    db = SessionLocal()
    try:
        rows = db.query(Transaction).all()
        dividends = [r for r in rows if r.kind == "dividend"]
        total_dividends = sum(r.total or 0 for r in dividends)
        total_fees = sum((r.fx_fee or 0) + (r.withholding_tax or 0) for r in rows)
        counts = {}
        for r in rows:
            counts[r.kind] = counts.get(r.kind, 0) + 1
    finally:
        db.close()

    # Enrich with live account summary from last sync
    cache = read_cache()
    investments = (cache.get("account_summary") or {}).get("investments") or {}
    cash = (cache.get("account_summary") or {}).get("cash") or {}

    return {
        "total_invested": round(investments.get("totalCost") or 0, 2),
        "current_value": round(investments.get("currentValue") or 0, 2),
        "unrealized_pnl": round(investments.get("unrealizedProfitLoss") or 0, 2),
        "realized_pnl": round(investments.get("realizedProfitLoss") or 0, 2),
        "available_cash": round(cash.get("availableToTrade") or 0, 2),
        "total_dividends": round(total_dividends, 2),
        "total_fees": round(total_fees, 2),
        "transaction_counts": counts,
    }


@app.get("/portfolio/positions")
def get_positions() -> Any:
    cache = read_cache()
    positions = cache.get("positions") or []
    result = []
    for p in positions:
        inst = p.get("instrument") or {}
        wallet = p.get("walletImpact") or {}
        result.append({
            "ticker": strip_ticker_suffix(p.get("ticker") or inst.get("ticker") or ""),
            "name": inst.get("name", ""),
            "isin": inst.get("isin", ""),
            "quantity": p.get("quantity"),
            "avg_price": p.get("averagePricePaid"),
            "current_price": p.get("currentPrice"),
            "current_value": wallet.get("currentValue"),
            "total_cost": wallet.get("totalCost"),
            "unrealized_pnl": wallet.get("unrealizedProfitLoss"),
            "fx_impact": wallet.get("fxImpact"),
            "currency": wallet.get("currency"),
        })
    return sorted(result, key=lambda x: x["current_value"] or 0, reverse=True)


@app.get("/portfolio/pies")
def get_pies() -> Any:
    cache = read_cache()
    return cache.get("pies") or []


@app.get("/portfolio/allocation")
def get_allocation() -> Any:
    db = SessionLocal()
    try:
        trades = db.query(Transaction).filter(Transaction.kind == "trade").all()
        totals: dict[str, dict] = defaultdict(lambda: {"ticker": "", "name": "", "total_invested": 0.0})
        for t in trades:
            if not t.ticker or not t.total:
                continue
            totals[t.ticker]["ticker"] = t.ticker
            totals[t.ticker]["name"] = t.name or t.ticker
            totals[t.ticker]["total_invested"] += abs(t.total)
        items = sorted(totals.values(), key=lambda x: x["total_invested"], reverse=True)
        top8 = items[:8]
        other = sum(x["total_invested"] for x in items[8:])
        if other > 0:
            top8.append({"ticker": "Other", "name": "Other", "total_invested": round(other, 2)})
        return [{"ticker": x["ticker"], "name": x["name"], "total_invested": round(x["total_invested"], 2)} for x in top8]
    finally:
        db.close()


@app.get("/portfolio/cashflow")
def get_cashflow(granularity: str = Query("monthly")) -> Any:
    db = SessionLocal()
    try:
        rows = db.query(Transaction).all()
        grouped: dict[str, dict] = defaultdict(lambda: {"month": "", "invested": 0.0, "dividends": 0.0})
        for r in rows:
            if not r.time or not r.total:
                continue
            key = r.time[:10] if granularity == "daily" else r.time[:7]
            grouped[key]["month"] = key
            if r.kind == "trade" and r.total < 0:
                grouped[key]["invested"] += abs(r.total)
            elif r.kind == "dividend":
                grouped[key]["dividends"] += r.total
        result = sorted(grouped.values(), key=lambda x: x["month"])
        return [{"month": x["month"], "invested": round(x["invested"], 2), "dividends": round(x["dividends"], 2)} for x in result]
    finally:
        db.close()


@app.get("/portfolio/dividends/by-ticker")
def get_dividends_by_ticker() -> Any:
    db = SessionLocal()
    try:
        rows = db.query(Transaction).filter(Transaction.kind == "dividend").all()
        monthly: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
        for r in rows:
            if not r.time or not r.total:
                continue
            month = r.time[:7]
            ticker = r.ticker or r.name or "Unknown"
            monthly[month][ticker] += r.total
        result = []
        for month in sorted(monthly.keys()):
            entry: dict = {"month": month}
            entry.update({k: round(v, 4) for k, v in monthly[month].items()})
            result.append(entry)
        return result
    finally:
        db.close()


@app.get("/portfolio/account-breakdown")
def get_account_breakdown() -> Any:
    db = SessionLocal()
    try:
        rows = db.query(Transaction).filter(Transaction.kind == "trade").all()
        totals: dict[str, float] = {}
        for r in rows:
            key = r.account_type or "invest"
            totals[key] = totals.get(key, 0.0) + abs(r.total or 0)
        return [
            {"account": k, "value": round(v, 2)}
            for k, v in sorted(totals.items())
            if v > 0
        ]
    finally:
        db.close()


@app.post("/api-sync")
async def api_sync(body: ApiSyncRequest) -> Any:
    if body.api_secret:
        encoded = base64.b64encode(f"{body.api_key}:{body.api_secret}".encode()).decode()
        auth_value = f"Basic {encoded}"
    else:
        auth_value = body.api_key
    headers = {"Authorization": auth_value}
    host = "demo.trading212.com" if body.account_type == "demo" else "live.trading212.com"
    base = f"https://{host}/api/v0"

    headers.update({
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-GB,en;q=0.9",
    })
    async with httpx.AsyncClient(headers=headers, timeout=60.0, follow_redirects=True) as client:
        try:
            orders, dividends, cash_txs, account_summary, positions_resp = await asyncio.gather(
                fetch_all_pages(client, f"{base}/equity/history/orders"),
                fetch_all_pages(client, f"{base}/history/dividends"),
                fetch_all_pages(client, f"{base}/history/transactions"),
                client.get(f"{base}/equity/account/summary"),
                client.get(f"{base}/equity/positions"),
            )
            summary_data = account_summary.json()
            positions_data = positions_resp.json() if positions_resp.status_code == 200 else []

            # Pies: fetch list then details for each concurrently
            pies_list_resp = await client.get(f"{base}/equity/pies")
            pies_list = pies_list_resp.json() if pies_list_resp.status_code == 200 else []
            if pies_list:
                pie_detail_resps = await asyncio.gather(*[
                    client.get(f"{base}/equity/pies/{p['id']}") for p in pies_list
                ])
                pies_data = []
                for summary, detail_resp in zip(pies_list, pie_detail_resps):
                    detail = detail_resp.json() if detail_resp.status_code == 200 else {}
                    settings = detail.get("settings") or {}
                    result = summary.get("result") or {}
                    pies_data.append({
                        "id": summary.get("id"),
                        "name": settings.get("name", f"Pie {summary.get('id')}"),
                        "goal": settings.get("goal"),
                        "progress": summary.get("progress"),
                        "status": summary.get("status"),
                        "cash": summary.get("cash"),
                        "invested": result.get("priceAvgInvestedValue"),
                        "current_value": result.get("priceAvgValue"),
                        "pnl": result.get("priceAvgResult"),
                        "pnl_pct": result.get("priceAvgResultCoef"),
                        "dividends_gained": (summary.get("dividendDetails") or {}).get("gained"),
                        "dividends_reinvested": (summary.get("dividendDetails") or {}).get("reinvested"),
                    })
            else:
                pies_data = []

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise HTTPException(status_code=401, detail=f"Invalid API key — T212 says: {e.response.text}")
            raise HTTPException(status_code=502, detail=f"Trading 212 API error: {e.response.status_code} — {e.response.text}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Network error: {str(e)}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Fetch error: {type(e).__name__}: {str(e)}")

    try:
        mapped = (
            [map_order(o) for o in orders]
            + [map_dividend(d) for d in dividends]
            + [map_cash(c) for c in cash_txs]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mapping error: {str(e)}")

    db = SessionLocal()
    inserted = skipped = 0
    try:
        for t in mapped:
            t212_id = t.get("t212_id")
            if t212_id and db.query(Transaction).filter(Transaction.t212_id == t212_id).first():
                skipped += 1
                continue
            t["account_type"] = body.product_type
            db.add(Transaction(**t))
            inserted += 1
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        db.close()

    write_cache({
        "positions": positions_data,
        "account_summary": summary_data,
        "pies": pies_data,
    })

    return {
        "inserted": inserted,
        "skipped": skipped,
        "fetched": {"orders": len(orders), "dividends": len(dividends), "cash": len(cash_txs)},
    }
