
from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from backend.database import Base

class Transaction(Base):
    __tablename__ = "transactions"

    #Created by us ie it doesnt come from the csv
    id = Column(Integer, primary_key= True, index=True) #postg will index for faster lookup
    created_at = Column(DateTime, server_default=func.now())
    t212_id = Column(String, unique=True, nullable=True, index=True)


    # Identity
    kind = Column(String, nullable=False)
    account_type = Column(String)  # invest | stocks-isa | cfd | cash-isa
    action = Column(String)
    time = Column(String)
    isin = Column(String)
    ticker = Column(String)
    name = Column(String)
    
    #Trade Fields
    shares = Column(Float)
    price_per_share = Column(Float)
    price_currency = Column(String)
    exchange_rate = Column(Float)

    #Result
    result = Column(Float)
    result_currency = Column(String)
    total = Column(Float)
    total_currency = Column(String)

    # Fees & Tax
    withholding_tax = Column(Float)
    withholding_tax_currency = Column(String)
    fx_fee = Column(Float)
    fx_fee_currency = Column(String)

    #Card fields 
    merchant_name = Column(String)
    merchant_category = Column(String)

    #Parse metadata
    notes = Column(String)
    parse_error = Column(String)

