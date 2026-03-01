import csv
import io
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import List, Dict, Any, Optional

def classify_kind(action: str) -> str:
    """Classify transaction kind based on Action Field"""
    if action in ("Market buy", "Market sell"):
        return "trade"
    elif action.startswith("Dividend"):
        return "dividend"
    elif action in ("Deposit", "Withdrawal","Interest on cash", "Spending cashback"):
        return "cash"
    else:
        return "unknown"

def parse_decimal(value: str) -> Optional[float]:
    """ Parse decimal string to float, return None if empty/invalid.  """
    if not value or value.strip() == "":
        return None
    try:
        return float(Decimal(value))
    except (InvalidOperation, ValueError):
        return None

def parse_datetime(value: str) -> Optional[str]:
    """Parse Trading212 datetime to ISO string."""
    if not value or value.strip() == "":
        return None
    try: 
        dt = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
        return dt.isoformat()
    except ValueError:
        return None

def validate_transaction(row: Dict[str,str], kind: str) -> List[str]:
    """Validate required fields based on transaction kind."""
    errors = []

    #Required for all rows
    required_all = ["Action", "Time", "Total", "Currency (Total)"]
    for field in required_all:
        if field not in row or not row[field].strip():
            errors.append(f"Missing required fields: {field}")
    
    # Trade-Specific Validation
    if kind == "trade":
        if not row.get("Ticker") and not row.get("ISIN"):
            errors.append("Trade requires Ticker or ISIN")
        if not row.get("No. of shares"):
            errors.append("Trade requires number of shares")
        if not row.get("Price / share"):
            errors.append("Trade requires Price / Share")
    
    #Card specfic validation
    elif kind == "card":
        if not row.get("Merchant name"):
            errors.append("Card transaction requires Merchant name")
    
    #Dividend-specific validation
    elif kind == "dividend":
        if not row.get("No. of shares"):
            errors.append("Dividen requires No. of shares")

    return errors

def parse_row(row: Dict[str, str], row_num: int) -> Dict[str, Any]:
    """Parse a single CSV row into a normalized transaction"""
    action = row.get("Action","")
    kind = classify_kind(action)

    #Basic Validation
    errors = validate_transaction(row, kind)

    #Parse fields 

    transaction = {
        "action" : action or None,
        "time" : parse_datetime(row.get("Time", "")),
        "isin": row.get("ISIN") if row.get("ISIN") else None,
        "ticker": row.get("Ticker") if row.get("Ticker") else None,
        "name": row.get("Name") if row.get("Name") else None,
        "notes": row.get("Notes") if row.get("Notes") else None,
        "id": row.get("ID") if row.get("ID") else None,

        "shares": parse_decimal(row.get("No. of shares", "")),
        "price_per_share": parse_decimal(row.get("Price / share", "")),
        "price_currency": row.get("Currency (Price / Share)","") if row.get("Currency (Price / share)") else None,
        "exchange_rate": parse_decimal(row.get("Exchange rate", "")),
        
        "result": parse_decimal(row.get("Result","")),
        "result_currency": row.get("Currency (Result)") if row.get("Currency (Result)") else None,

        "total": parse_decimal(row.get("Total", "")),
        "total_currency": row.get("Currency (Total)") if row.get("Currency (Total)") else None,

        "withholding_tax": parse_decimal(row.get("Withholding tax", "")),
        "withholding_tax_currency": row.get("Currency (Withholding tax)", "") if row.get("Currency (Withholding tax)") else None,

        "fx_fee": parse_decimal(row.get("Currency conversion fee", "")),
        "fx_fee_currency": row.get("Currency (Currency conversion fee)") if row.get("Currency (Currency conversion fee)") else None,

        "merchant_name": row.get("Merchant name") if row.get("Merchant name") else None,
        "merchant_category": row.get("Merchant category") if row.get("Merchant category") else None,

        "kind":kind,
        "parse_error": "; ".join(errors) if errors else None 

    }

    return transaction



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

    # Initialize result structure

    result = {
        "transactions": [],
        "summary": {
            "total_rows": 0,
            "parsed_rows": 0,
            "error_rows": 0,
            "by_kind": {"trade":0, "dividend":0, "cash": 0, "card":0, "unknown":0},
            "by_currency":{}
        },
        "schema": {
            "headers": [],
            "missing_columns": []
        },
        "errors": []
    }

    try:
        #Decode content and parse CSV export into a unified list of transactions.
        text_content = content.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(text_content))

        # Store headers
        result["schema"]["headers"] = csv_reader.fieldnames or []

        #Check for required columns
        required_columns = ["Action", "Time", "Total", "Currency (Total)"]

        for col in required_columns:
            if col not in result["schema"]["headers"]:
                result["schema"]["missing_columns"].append(col)

        #Parse each row
        for row_num, row in enumerate(csv_reader, start=2): #Start 2 cause row 1 is headers
            result["summary"]["total_rows"] += 1

            transaction = parse_row(row, row_num)
            result["transactions"].append(transaction)

            # Update summary
            if transaction["parse_error"]:
                result["summary"]["error_rows"] += 1
                result["errors"].append(f"Row {row_num}: {transaction['parse_error']}")
            else:
                result["summary"]["parsed_rows"] += 1 

            #Update kind counts
            kind = transaction["kind"]
            if kind in result["summary"]["by_kind"]:
                result["summary"]["by_kind"][kind] +=  1

            #Update currency totals
            if transaction["total"] is not None and transaction["total_currency"]:
                currency = transaction["total_currency"]
                if currency not in result["summary"]["by_currency"]:
                    result["summary"]["by_currency"][currency] = {"total": 0.0}
                result["summary"]["by_currency"][currency]["total"] += transaction["total"]

    except Exception as e:
        result["errors"].append(f"Failed to parse CSV: {str(e)}")
    return result
