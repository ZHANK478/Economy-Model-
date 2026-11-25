"""Read ONS local-authority current-price GVA for 2000 (Table 3 of ITL1 workbooks)."""
import json
import sys
from pathlib import Path

from openpyxl import load_workbook


CITIES = {
    "TLC": ["E08000021"], "TLD": ["E08000003"], "TLE": ["E08000035"],
    "TLF": ["E06000018"], "TLG": ["E08000025"], "TLH": ["E06000033"],
    "TLJ": ["E06000043"], "TLK": ["E06000023"], "TLL": ["W06000015"],
    "TLM": ["S12000036", "S12000049"], "TLN": ["N09000003"],
}


def read_region(workbook, cities):
    table = load_workbook(workbook, read_only=True, data_only=True)["Table 3"]
    columns = iter(table.values)
    next(columns)
    year = next(columns).index("2000")
    data = {city: {} for city in cities}
    for row in columns:
        if row[1] in data and isinstance(row[year], (int, float)):
            data[row[1]][row[3]] = row[year]
    for city, industries in data.items():
        yield city, [industries["AB (1-9)"], industries["DE (35-39)"],
                     industries["C (10-33)"], industries["F (41-43)"], industries["G-T"]]


if __name__ == "__main__":
    directory = Path(sys.argv[1])
    print("// ONS local-authority GVA (balanced), 2000, current prices, £m.")
    print("// Agriculture and extraction are published jointly in the first column.")
    print("export const UK_CITY_INDUSTRIES_2000 = {")
    for region, cities in CITIES.items():
        for city, sectors in read_region(directory / f"{region}.xlsx", cities):
            print(f"  {city}: {json.dumps(sectors)},")
    print("};")
