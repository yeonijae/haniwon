#!/usr/bin/env python3
"""Seed diagnosis_code_map from MSSQL Detail.DxName and InsuPx.kcd3."""
import requests

MSSQL='http://192.168.0.48:3100/api/execute'
PG='http://192.168.0.48:3200/api/execute'


def sql_lit(s):
    return "'" + str(s).replace("'", "''") + "'"


def norm(s: str) -> str:
    s = str(s)
    for ch in [' ', '　', '(', ')', '（', '）', ',', '，', '·', '・', '\t', '\r', '\n']:
        s = s.replace(ch, '')
    return s.strip().lower()


def main():
    dx_rows = requests.post(MSSQL, json={
        "sql": "SELECT DISTINCT LTRIM(RTRIM(DxName)) AS dx_name FROM Detail WHERE DxName IS NOT NULL AND LTRIM(RTRIM(DxName))<>''"
    }, timeout=180).json()['rows']
    dx_names = [r[0] for r in dx_rows]

    k_rows = requests.post(MSSQL, json={
        "sql": "SELECT DxCode, DxName FROM InsuPx.dbo.kcd3 WHERE DxCode IS NOT NULL AND LTRIM(RTRIM(DxCode))<>'' AND DxName IS NOT NULL AND LTRIM(RTRIM(DxName))<>''"
    }, timeout=240).json()['rows']

    mapping = {}
    for code, name in k_rows:
        n = norm(name)
        if not n:
            continue
        prev = mapping.get(n)
        if prev is None or str(code) < prev[0]:
            mapping[n] = (str(code), str(name))

    total = mapped = 0
    for dx in dx_names:
        n = norm(dx)
        code = kname = None
        source = 'seed'
        confidence = '0.600'
        if n in mapping:
            code, kname = mapping[n]
            source = 'insupx'
            confidence = '0.950'
            mapped += 1

        sql = f"""
        INSERT INTO diagnosis_code_map
          (dx_name_raw, dx_name_norm, kcd_code, kcd_name, source, confidence, is_active)
        VALUES
          ({sql_lit(dx)}, {sql_lit(n)}, {sql_lit(code) if code else 'NULL'}, {sql_lit(kname) if kname else 'NULL'}, {sql_lit(source)}, {confidence}, true)
        ON CONFLICT (dx_name_raw)
        DO UPDATE SET
          dx_name_norm = EXCLUDED.dx_name_norm,
          kcd_code = EXCLUDED.kcd_code,
          kcd_name = EXCLUDED.kcd_name,
          source = EXCLUDED.source,
          confidence = EXCLUDED.confidence,
          is_active = true,
          updated_at = now();
        """

        resp = requests.post(PG, json={"sql": sql}, timeout=60)
        resp.raise_for_status()
        total += 1

    print({"total_dx": total, "mapped": mapped, "unmapped": total - mapped})


if __name__ == '__main__':
    main()
