"""Builds public/data/airports.json from the MIT-licensed `airportsdata` package
(pip install airportsdata). Every airport with an IATA code: code, name, city,
country, time zone and position. Run again to refresh."""
import json, airportsdata, importlib.metadata as m

# Cities as travellers say them.
CITY = {"IST": "Istanbul", "SAW": "Istanbul", "YYZ": "Toronto", "JTR": "Santorini", "JMK": "Mykonos",
        "FRA": "Frankfurt", "PKX": "Beijing", "PEK": "Beijing", "HND": "Tokyo", "NRT": "Tokyo",
        "KIX": "Osaka", "ICN": "Seoul", "DMK": "Bangkok", "BKK": "Bangkok", "DWC": "Dubai",
        "GRU": "São Paulo", "GIG": "Rio de Janeiro", "EZE": "Buenos Aires", "CGK": "Jakarta",
        "KUL": "Kuala Lumpur", "STN": "London", "LTN": "London", "LCY": "London", "LGW": "London",
        "ORY": "Paris", "BER": "Berlin", "MXP": "Milan", "LIN": "Milan", "BGY": "Milan"}

def city(code, a):
    c = CITY.get(code) or (a["city"] or a["name"]).strip()
    if ", " in c:
        c = c.split(", ")[-1]
    if c.endswith(" Island") and len(c) > 7:
        c = c[: -len(" Island")]
    return c

rows = []
for code, a in sorted(airportsdata.load("IATA").items()):
    if not a["city"] and not a["name"]:
        continue
    rows.append([
        code,
        a["name"].strip(),
        city(code, a),
        a["country"],
        a["tz"],
        round(a["lat"], 4),
        round(a["lon"], 4),
    ])
out = {"source": f"airportsdata {m.version('airportsdata')} (MIT)", "fields": ["iata", "name", "city", "country", "tz", "lat", "lon"], "airports": rows}
json.dump(out, open("public/data/airports.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(rows), "airports")
