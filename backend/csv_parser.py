import csv
import io
from datetime import datetime
from decimal import Decimal
from typing import List, Dict, Any, Optional

def classify_kind(action: str) -> str:
    """Classify transaction kind based on Action Field"""
    if action in ("Market buy", "Market sell"):
        return "trade"
    elif action.startswith("Dividend"):
        return "dividend"
    elif action in ("Deposit", "Withdrawal","Interest on cash", "Spending Cashback"):
        return "cash"
    else:
        return "unknown"

def parse_trading212_csv(content: bytes) -> dict:
    """
    Parse Trading212 CSV export into a unified list of transactions.

    Returns:
    {
        "transactions: List[dict[]} #unified list with `kind` field
        "summary": {
        "total_rows:int,
        "parsed_rows:int,
        "error_rows":int,
        "by_kind": {"trade"}:int, "dividend: int, "cash":int, "card":int, "unknown": int},
        "by_currency": {"GBP":{"total": Decimal}, "USD": {"total": Decimal}, ...}
        },
        "schema": {"headers": List[str], "missing_columns": List[str],
        "errors": List[str] # row level errors 
        }

        """