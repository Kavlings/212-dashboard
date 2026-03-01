
from csv_parser import parse_trading212_csv

with open('from_2025-09-26_to_2026-02-05_MTc3MDI4MDI0NDkyOQ.csv','rb') as f:
    result = parse_trading212_csv(f.read())

print(f"Total rows: {result['summary']['total_rows']}")
print(f"Parsed rows: {result['summary']['parsed_rows']}")
print(f"Error rows: {result['summary']['error_rows']}")
print(f"By kind: {result['summary']['by_kind']}")
print(f"First transaction: {result['transactions'][0]}")