from backend.csv_parser import parse_trading212_csv
from backend.database import SessionLocal
from backend.models import Transaction
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from typing import Any

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
            t_data = {k:v for k, v in t.items() if k != 'id'}
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

