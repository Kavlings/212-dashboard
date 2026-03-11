# Plan: Add Database Load Layer (PostgreSQL + SQLAlchemy)

## Context
The CSV parsing pipeline (Extract + Transform) is complete. Parsed data is currently returned as JSON and discarded — nothing is persisted. This plan adds the Load step: saving every parsed transaction to PostgreSQL so the dashboard can later query and display it.

---

## Files to Create
- `backend/database.py` — SQLAlchemy engine, SessionLocal, Base, get_db dependency
- `backend/models.py` — Transaction ORM model
- `.env` — DATABASE_URL (not committed)
- `.gitignore` — protect .env and pycache

## Files to Modify
- `requirements.txt` — add 4 new packages
- `backend/main.py` — inject DB session into /upload, save parsed rows after parsing

## Alembic (run after files are created)
- `alembic init alembic` — scaffolds alembic.ini + alembic/env.py
- Edit `alembic.ini`: set `sqlalchemy.url = postgresql://placeholder`
- Edit `alembic/env.py`: load .env, set DATABASE_URL, point `target_metadata = Base.metadata`
- `alembic revision --autogenerate -m "create transactions table"`
- `alembic upgrade head`

---

## Step-by-step

### 1. requirements.txt — add below existing lines
```
SQLAlchemy==2.0.23
psycopg2-binary==2.9.9
alembic==1.13.0
python-dotenv==1.0.0
```

### 2. .gitignore (create at project root)
```
.env
__pycache__/
*.pyc
venv/
.venv/
```

### 3. .env (create at project root, never commit)
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/dashboard212
```

### 4. backend/database.py
```python
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### 5. backend/models.py
Key design decision: T212's own `id` field (a UUID string) is renamed to `t212_id` on the model to avoid collision with SQLAlchemy's primary key convention. A surrogate integer `pk` is the real primary key. `t212_id` has a UNIQUE constraint for duplicate detection.

```python
from datetime import datetime
from sqlalchemy import Integer, String, Float, DateTime, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from backend.database import Base

class Transaction(Base):
    __tablename__ = "transactions"

    pk:                       Mapped[int]        = mapped_column(Integer, primary_key=True, autoincrement=True)
    t212_id:                  Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    action:                   Mapped[str | None] = mapped_column(String(64))
    time:                     Mapped[datetime | None] = mapped_column(DateTime)
    kind:                     Mapped[str | None] = mapped_column(String(32), index=True)
    isin:                     Mapped[str | None] = mapped_column(String(16))
    ticker:                   Mapped[str | None] = mapped_column(String(16))
    name:                     Mapped[str | None] = mapped_column(Text)
    notes:                    Mapped[str | None] = mapped_column(Text)
    shares:                   Mapped[float | None] = mapped_column(Float)
    price_per_share:          Mapped[float | None] = mapped_column(Float)
    price_currency:           Mapped[str | None] = mapped_column(String(8))
    exchange_rate:            Mapped[float | None] = mapped_column(Float)
    result:                   Mapped[float | None] = mapped_column(Float)
    result_currency:          Mapped[str | None] = mapped_column(String(8))
    total:                    Mapped[float | None] = mapped_column(Float)
    total_currency:           Mapped[str | None] = mapped_column(String(8))
    withholding_tax:          Mapped[float | None] = mapped_column(Float)
    withholding_tax_currency: Mapped[str | None] = mapped_column(String(8))
    fx_fee:                   Mapped[float | None] = mapped_column(Float)
    fx_fee_currency:          Mapped[str | None] = mapped_column(String(8))
    merchant_name:            Mapped[str | None] = mapped_column(String(128))
    merchant_category:        Mapped[str | None] = mapped_column(String(64))
    parse_error:              Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        UniqueConstraint("t212_id", name="uq_transaction_t212_id"),
    )
```

### 6. backend/main.py — changes
Add imports:
```python
from datetime import datetime
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from fastapi import Depends
from backend.database import get_db
from backend.models import Transaction
```

Update route signature:
```python
@app.post("/upload")
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db)) -> Any:
```

After `parsed = parse_trading212_csv(content)`, add save loop:
```python
saved_count = 0
skipped_count = 0

for txn in parsed["transactions"]:
    time_value = datetime.fromisoformat(txn["time"]) if txn.get("time") else None
    row = Transaction(
        t212_id=txn.get("id"),
        action=txn.get("action"),
        time=time_value,
        kind=txn.get("kind"),
        isin=txn.get("isin"),
        ticker=txn.get("ticker"),
        name=txn.get("name"),
        notes=txn.get("notes"),
        shares=txn.get("shares"),
        price_per_share=txn.get("price_per_share"),
        price_currency=txn.get("price_currency"),
        exchange_rate=txn.get("exchange_rate"),
        result=txn.get("result"),
        result_currency=txn.get("result_currency"),
        total=txn.get("total"),
        total_currency=txn.get("total_currency"),
        withholding_tax=txn.get("withholding_tax"),
        withholding_tax_currency=txn.get("withholding_tax_currency"),
        fx_fee=txn.get("fx_fee"),
        fx_fee_currency=txn.get("fx_fee_currency"),
        merchant_name=txn.get("merchant_name"),
        merchant_category=txn.get("merchant_category"),
        parse_error=txn.get("parse_error"),
    )
    try:
        with db.begin_nested():  # SAVEPOINT — isolates each row
            db.add(row)
            db.flush()
        saved_count += 1
    except IntegrityError:
        skipped_count += 1  # duplicate t212_id, skip silently

db.commit()
```

Update the return to include DB stats (existing `parsed` key unchanged):
```python
return JSONResponse({
    "filename": file.filename,
    "size_bytes": len(content),
    "db": {"saved": saved_count, "skipped_duplicates": skipped_count},
    "parsed": parsed
})
```

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| Sync SQLAlchemy (not async) | Simpler at this stage; FastAPI handles async at the route level |
| Surrogate `pk` + `t212_id` | Avoids naming collision; `t212_id` is the dedup key |
| `begin_nested()` per row | PostgreSQL SAVEPOINTs allow skipping duplicate rows without aborting the whole batch |
| `t212_id` nullable | Some T212 rows (e.g. deposits) may lack an ID; they insert without dedup protection |
| `Float` not `Numeric` | Matches what the parser already returns; migrate to `Numeric` later if exact P&L math is needed |

---

## Verification
1. `pip install -r requirements.txt` — no errors
2. `alembic upgrade head` — table created in Postgres
3. `uvicorn backend.main:app --reload` — starts without errors
4. Upload the sample CSV (`backend/from_2025-09-26_to_2026-02-05_*.csv`) via the frontend
5. Response JSON includes `"db": {"saved": N, "skipped_duplicates": 0}`
6. Upload the same CSV again — response shows `"skipped_duplicates": N`, `"saved": 0`
7. Query Postgres directly: `SELECT COUNT(*), kind FROM transactions GROUP BY kind;`
