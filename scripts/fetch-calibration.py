"""Reproducible public-source snapshot; no game or player data is transmitted."""
import csv
import io
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from urllib.request import urlopen

COUNTRIES = ['BGD', 'MEX', 'FRA']
INDICATORS = {
    'gdpPerCapita': 'NY.GDP.PCAP.CD',
    'agricultureEmployment': 'SL.AGR.EMPL.ZS',
    'industryEmployment': 'SL.IND.EMPL.ZS',
    'servicesEmployment': 'SL.SRV.EMPL.ZS',
    'agricultureValueAdded': 'NV.AGR.TOTL.ZS',
    'lifeExpectancy': 'SP.DYN.LE00.IN',
    'fertility': 'SP.DYN.TFRT.IN',
    'privateCredit': 'FS.AST.PRVT.GD.ZS',
    'childShare14': 'SP.POP.0014.TO.ZS',
    'elderlyShare': 'SP.POP.65UP.TO.ZS',
    'exportsGDP': 'NE.EXP.GNFS.ZS',
    'importsGDP': 'NE.IMP.GNFS.ZS',
}


def fetch_indicator(item):
    key, code = item
    url = f'https://api.worldbank.org/v2/country/{";".join(COUNTRIES)}/indicator/{code}?date=1998:2002&format=json&per_page=100'
    cache = Path('/tmp/economy-calibration-cache')
    cache.mkdir(exist_ok=True)
    cached = cache / (code + '.json')
    if cached.exists():
        payload = json.loads(cached.read_text())
    else:
        for attempt in range(3):
            try:
                with urlopen(url, timeout=20) as response:
                    payload = json.load(response)
                cached.write_text(json.dumps(payload))
                break
            except (TimeoutError, OSError):
                if attempt == 2:
                    raise
    result = {}
    for country in COUNTRIES:
        available = [r for r in payload[1] if r['countryiso3code'] == country and r['value'] is not None]
        if available:
            row = min(available, key=lambda r: abs(int(r['date']) - 2000))
            result[country] = {'value': row['value'], 'year': int(row['date'])}
        else:
            result[country] = {'value': None, 'year': None}
    return key, {'indicator': code, 'source': url, 'observations': result}


with ThreadPoolExecutor(max_workers=4) as pool:
    observations = dict(pool.map(fetch_indicator, INDICATORS.items()))

school_url = 'https://barrolee.github.io/BarroLeeDataSet/BLData/BL_v3_MF1564.csv'
with urlopen(school_url, timeout=40) as response:
    rows = list(csv.DictReader(io.StringIO(response.read().decode('utf-8-sig'))))
schooling = {}
for row in rows:
    if row['WBcode'] in COUNTRIES and int(row['year']) == 2000:
        schooling[row['WBcode']] = {'value': float(row['yr_sch']), 'year': 2000}
if set(schooling) != set(COUNTRIES):
    raise ValueError('Missing Barro-Lee country observations')
observations['schooling'] = {'source': school_url, 'definition': 'Completed schooling, both sexes, ages 15-64, Barro-Lee v3, yr_sch', 'observations': schooling}
destination = Path(__file__).resolve().parents[1] / 'docs' / 'calibration-2000.json'
destination.write_text(json.dumps({'retrieved': str(date.today()), 'targetYear': 2000, 'observations': observations}, ensure_ascii=False, indent=2) + '\n')
runtime = {country: {key: item['observations'][country]['value'] for key, item in observations.items()} for country in COUNTRIES}
for country in COUNTRIES:
    runtime[country]['privateCreditYear'] = observations['privateCredit']['observations'][country]['year']
(destination.parent.parent / 'src' / 'economic-observations.js').write_text('// Generated from primary-source snapshot docs/calibration-2000.json.\nexport const OBSERVATIONS=' + json.dumps(runtime, separators=(',', ':')) + ';\n')
print(json.dumps({'path': str(destination), 'observations': {key: item['observations'] for key, item in observations.items()}}, ensure_ascii=False))
