#!/usr/bin/env python3
"""
BountyOS Open-Source CVE & Threat Intelligence Database Tool
-----------------------------------------------------------
Aggregates, indexes, and queries open-source vulnerability feeds:
  1. CISA KEV (Known Exploited Vulnerabilities Catalog)
  2. FIRST.org / Cyentia EPSS (Exploit Prediction Scoring System)
  3. CVE Project Official CVE List v5 (MITRE / CVE.org JSON 5.0)
  4. Google OSV.dev & GitHub Advisory Database (Open Source Ecosystems)
  5. NIST NVD API 2.0 (On-demand enrichment)

Stores unified records into a local, high-performance SQLite database:
  data/cve.db
"""

import argparse
import csv
import gzip
import io
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.request
import zipfile
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "cve.db")

USER_AGENT = "BountyOS-CVE-Sync/1.0 (+https://github.com/Mr-IR0k-oo1/Bounty-OS)"

URLS = {
    "cisa_kev": "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
    "epss": "https://epss.cyentia.com/epss_scores-current.csv.gz",
    "cvelist_releases": "https://api.github.com/repos/CVEProject/cvelistV5/releases/latest",
    "osv_base": "https://osv-vulnerabilities.storage.googleapis.com",
    "nvd_api": "https://services.nvd.nist.gov/rest/json/cves/2.0",
}

DEFAULT_OSV_ECOSYSTEMS = ["crates.io", "Go", "PyPI", "npm", "Maven"]


def get_db(db_path=DB_PATH):
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    return conn


def init_db(conn):
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS cves (
                cve_id TEXT PRIMARY KEY,
                title TEXT,
                description TEXT,
                severity TEXT,
                cvss_score REAL,
                cvss_vector TEXT,
                cwe_id TEXT,
                epss_score REAL,
                epss_percentile REAL,
                is_kev INTEGER DEFAULT 0,
                kev_vendor TEXT,
                kev_product TEXT,
                kev_date_added TEXT,
                kev_ransomware TEXT,
                kev_due_date TEXT,
                published_at TEXT,
                updated_at TEXT,
                sources TEXT,
                raw_json TEXT
            );
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS osv_advisories (
                id TEXT PRIMARY KEY,
                cve_id TEXT,
                ecosystem TEXT,
                package_name TEXT,
                summary TEXT,
                details TEXT,
                severity TEXT,
                published_at TEXT,
                modified_at TEXT,
                references_json TEXT
            );
        """)

        conn.execute("CREATE INDEX IF NOT EXISTS idx_cves_epss ON cves(epss_score DESC);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_cves_kev ON cves(is_kev);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_cves_cwe ON cves(cwe_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_cves_severity ON cves(severity);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_cves_published ON cves(published_at DESC);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_osv_cve ON osv_advisories(cve_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_osv_pkg ON osv_advisories(package_name, ecosystem);")

        conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS cves_fts USING fts5(
                cve_id,
                title,
                description,
                cwe_id,
                content='cves',
                content_rowid='rowid'
            );
        """)

        conn.execute("""
            CREATE TRIGGER IF NOT EXISTS cves_ai AFTER INSERT ON cves BEGIN
                INSERT INTO cves_fts(rowid, cve_id, title, description, cwe_id)
                VALUES (new.rowid, new.cve_id, new.title, new.description, new.cwe_id);
            END;
        """)
        conn.execute("""
            CREATE TRIGGER IF NOT EXISTS cves_ad AFTER DELETE ON cves BEGIN
                INSERT INTO cves_fts(cves_fts, rowid, cve_id, title, description, cwe_id)
                VALUES('delete', old.rowid, old.cve_id, old.title, old.description, old.cwe_id);
            END;
        """)
        conn.execute("""
            CREATE TRIGGER IF NOT EXISTS cves_au AFTER UPDATE ON cves BEGIN
                INSERT INTO cves_fts(cves_fts, rowid, cve_id, title, description, cwe_id)
                VALUES('delete', old.rowid, old.cve_id, old.title, old.description, old.cwe_id);
                INSERT INTO cves_fts(rowid, cve_id, title, description, cwe_id)
                VALUES (new.rowid, new.cve_id, new.title, new.description, new.cwe_id);
            END;
        """)


def http_get(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    return urllib.request.urlopen(req, timeout=timeout)


def sync_cisa_kev(conn):
    print("\n[*] Fetching CISA Known Exploited Vulnerabilities (KEV)...")
    try:
        with http_get(URLS["cisa_kev"]) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[!] Failed to download CISA KEV: {e}")
        return 0

    vulns = data.get("vulnerabilities", [])
    print(f"    Downloaded {len(vulns)} KEV records. Ingesting into database...")

    cursor = conn.cursor()
    count = 0
    with conn:
        for v in vulns:
            cve_id = v.get("cveID", "").strip().upper()
            if not cve_id:
                continue

            title = v.get("vulnerabilityName")
            desc = v.get("shortDescription")
            vendor = v.get("vendorProject")
            product = v.get("product")
            date_added = v.get("dateAdded")
            due_date = v.get("dueDate")
            ransomware = v.get("knownRansomwareCampaignUse", "Unknown")

            cursor.execute("""
                INSERT INTO cves (
                    cve_id, title, description, is_kev,
                    kev_vendor, kev_product, kev_date_added,
                    kev_ransomware, kev_due_date, sources
                ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, 'cisa_kev')
                ON CONFLICT(cve_id) DO UPDATE SET
                    is_kev = 1,
                    title = COALESCE(cves.title, excluded.title),
                    description = COALESCE(cves.description, excluded.description),
                    kev_vendor = excluded.kev_vendor,
                    kev_product = excluded.kev_product,
                    kev_date_added = excluded.kev_date_added,
                    kev_ransomware = excluded.kev_ransomware,
                    kev_due_date = excluded.kev_due_date,
                    sources = CASE 
                        WHEN cves.sources NOT LIKE '%cisa_kev%' THEN cves.sources || ',cisa_kev' 
                        ELSE cves.sources 
                    END;
            """, (cve_id, title, desc, vendor, product, date_added, ransomware, due_date))
            count += 1

    print(f"[+] CISA KEV sync complete: {count} active exploits indexed.")
    return count


def sync_epss(conn):
    print("\n[*] Fetching FIRST / Cyentia EPSS Exploit Prediction Scores...")
    try:
        resp = http_get(URLS["epss"], timeout=90)
    except Exception as e:
        print(f"[!] Failed to download EPSS feed: {e}")
        return 0

    print("    Streaming and indexing EPSS scores...")
    cursor = conn.cursor()
    count = 0
    batch = []
    batch_size = 10000

    with gzip.GzipFile(fileobj=resp) as gz:
        reader = csv.reader(io.TextIOWrapper(gz, encoding="utf-8"))
        for row in reader:
            if not row or row[0].startswith("#") or row[0].lower() == "cve":
                continue
            try:
                cve_id = row[0].strip().upper()
                epss = float(row[1])
                pct = float(row[2])
                batch.append((epss, pct, cve_id))
                count += 1
            except (ValueError, IndexError):
                continue

            if len(batch) >= batch_size:
                with conn:
                    cursor.executemany("""
                        INSERT INTO cves (cve_id, epss_score, epss_percentile, sources)
                        VALUES (?, ?, ?, 'epss')
                        ON CONFLICT(cve_id) DO UPDATE SET
                            epss_score = excluded.epss_score,
                            epss_percentile = excluded.epss_percentile,
                            sources = CASE 
                                WHEN cves.sources NOT LIKE '%epss%' THEN cves.sources || ',epss' 
                                ELSE cves.sources 
                            END;
                    """, [(b[2], b[0], b[1]) for b in batch])
                batch.clear()
                print(f"    Processed {count:,} EPSS records...", end="\r", flush=True)

    if batch:
        with conn:
            cursor.executemany("""
                INSERT INTO cves (cve_id, epss_score, epss_percentile, sources)
                VALUES (?, ?, ?, 'epss')
                ON CONFLICT(cve_id) DO UPDATE SET
                    epss_score = excluded.epss_score,
                    epss_percentile = excluded.epss_percentile,
                    sources = CASE 
                        WHEN cves.sources NOT LIKE '%epss%' THEN cves.sources || ',epss' 
                        ELSE cves.sources 
                    END;
            """, [(b[2], b[0], b[1]) for b in batch])

    print(f"\n[+] EPSS sync complete: {count:,} scores indexed.")
    return count


def sync_osv(conn, ecosystems=None):
    if ecosystems is None:
        ecosystems = DEFAULT_OSV_ECOSYSTEMS

    print(f"\n[*] Fetching Open Source Vulnerabilities (OSV.dev) for: {', '.join(ecosystems)}...")
    cursor = conn.cursor()
    total_advisories = 0

    for eco in ecosystems:
        url = f"{URLS['osv_base']}/{eco}/all.zip"
        print(f"    Downloading {eco} advisory archive ({url})...")
        try:
            with http_get(url, timeout=120) as resp:
                zip_bytes = resp.read()
        except Exception as e:
            print(f"    [!] Failed to download {eco}: {e}")
            continue

        print(f"    Extracting & indexing {eco} advisories...")
        count = 0
        batch_osv = []
        batch_cve_update = []

        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            for fname in zf.namelist():
                if not fname.endswith(".json"):
                    continue
                try:
                    record = json.loads(zf.read(fname).decode("utf-8"))
                except Exception:
                    continue

                adv_id = record.get("id")
                if not adv_id:
                    continue

                summary = record.get("summary")
                details = record.get("details")
                published = record.get("published")
                modified = record.get("modified")
                aliases = record.get("aliases", [])

                cve_id = None
                for a in aliases:
                    if a.startswith("CVE-"):
                        cve_id = a.upper()
                        break

                package_name = None
                affected_list = record.get("affected", [])
                if affected_list:
                    package_name = affected_list[0].get("package", {}).get("name")

                refs = json.dumps(record.get("references", []))
                severity = None
                if record.get("severity"):
                    severity = str(record.get("severity"))

                batch_osv.append((
                    adv_id, cve_id, eco, package_name,
                    summary, details, severity, published, modified, refs
                ))

                if cve_id and (summary or details):
                    batch_cve_update.append((cve_id, summary, details, published, modified))

                count += 1

                if len(batch_osv) >= 2000:
                    with conn:
                        cursor.executemany("""
                            INSERT INTO osv_advisories (
                                id, cve_id, ecosystem, package_name,
                                summary, details, severity, published_at, modified_at, references_json
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                summary = excluded.summary,
                                details = excluded.details,
                                modified_at = excluded.modified_at,
                                references_json = excluded.references_json;
                        """, batch_osv)

                        cursor.executemany("""
                            INSERT INTO cves (cve_id, title, description, published_at, updated_at, sources)
                            VALUES (?, ?, ?, ?, ?, 'osv')
                            ON CONFLICT(cve_id) DO UPDATE SET
                                title = COALESCE(cves.title, excluded.title),
                                description = COALESCE(cves.description, excluded.description),
                                published_at = COALESCE(cves.published_at, excluded.published_at),
                                updated_at = COALESCE(cves.updated_at, excluded.updated_at),
                                sources = CASE 
                                    WHEN cves.sources NOT LIKE '%osv%' THEN cves.sources || ',osv' 
                                    ELSE cves.sources 
                                END;
                        """, batch_cve_update)

                    batch_osv.clear()
                    batch_cve_update.clear()

        if batch_osv:
            with conn:
                cursor.executemany("""
                    INSERT INTO osv_advisories (
                        id, cve_id, ecosystem, package_name,
                        summary, details, severity, published_at, modified_at, references_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        summary = excluded.summary,
                        details = excluded.details,
                        modified_at = excluded.modified_at,
                        references_json = excluded.references_json;
                """, batch_osv)

                cursor.executemany("""
                    INSERT INTO cves (cve_id, title, description, published_at, updated_at, sources)
                    VALUES (?, ?, ?, ?, ?, 'osv')
                    ON CONFLICT(cve_id) DO UPDATE SET
                        title = COALESCE(cves.title, excluded.title),
                        description = COALESCE(cves.description, excluded.description),
                        published_at = COALESCE(cves.published_at, excluded.published_at),
                        updated_at = COALESCE(cves.updated_at, excluded.updated_at),
                        sources = CASE 
                            WHEN cves.sources NOT LIKE '%osv%' THEN cves.sources || ',osv' 
                            ELSE cves.sources 
                        END;
                """, batch_cve_update)

        print(f"    [+] {eco}: {count:,} advisories indexed.")
        total_advisories += count

    print(f"[+] OSV sync complete: {total_advisories:,} open source advisories indexed.")
    return total_advisories


def sync_cvelist(conn, mode="delta"):
    print(f"\n[*] Fetching CVE Project CVE List v5 ({mode} mode)...")
    try:
        with http_get(URLS["cvelist_releases"], timeout=30) as resp:
            rel_data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[!] Failed to get CVEProject release info: {e}")
        return 0

    tag = rel_data.get("tag_name")
    assets = rel_data.get("assets", [])
    target_asset = None

    for a in assets:
        name = a.get("name", "")
        if mode == "delta" and "delta" in name:
            target_asset = a
            break
        elif mode == "all" and "all_CVEs" in name:
            target_asset = a
            break

    if not target_asset and assets:
        target_asset = assets[0]

    if not target_asset:
        print("[!] No matching CVE List v5 asset found in release.")
        return 0

    download_url = target_asset["browser_download_url"]
    file_size_mb = target_asset.get("size", 0) / (1024 * 1024)
    print(f"    Latest Release Tag: {tag}")
    print(f"    Asset: {target_asset['name']} ({file_size_mb:.1f} MB)")
    print(f"    Downloading from {download_url}...")

    try:
        with http_get(download_url, timeout=300) as resp:
            zip_bytes = resp.read()
    except Exception as e:
        print(f"[!] Failed to download CVE List archive: {e}")
        return 0

    print(f"    Processing CVE JSON 5.0 records in-memory...")
    cursor = conn.cursor()
    count = 0
    batch = []

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        namelist = [n for n in zf.namelist() if n.endswith(".json") and not n.startswith("__MACOSX")]
        total_files = len(namelist)
        print(f"    Extracting {total_files:,} CVE records...")

        for fname in namelist:
            try:
                cve_json = json.loads(zf.read(fname).decode("utf-8"))
            except Exception:
                continue

            meta = cve_json.get("cveMetadata", {})
            cve_id = meta.get("cveId", "").strip().upper()
            if not cve_id:
                continue

            pub_date = meta.get("datePublished")
            upd_date = meta.get("dateUpdated")

            cna = cve_json.get("containers", {}).get("cna", {})
            title = cna.get("title")

            desc = None
            for d in cna.get("descriptions", []):
                if d.get("lang", "").startswith("en"):
                    desc = d.get("value")
                    break
            if not desc and cna.get("descriptions"):
                desc = cna["descriptions"][0].get("value")

            cwe_id = None
            for pt in cna.get("problemTypes", []):
                for d in pt.get("descriptions", []):
                    cwe = d.get("cweId") or d.get("description")
                    if cwe and "CWE-" in cwe.upper():
                        cwe_id = cwe.strip()
                        break
                if cwe_id:
                    break

            cvss_score = None
            cvss_vector = None
            severity = None

            for m in cna.get("metrics", []):
                for k in ["cvssV3_1", "cvssV3_0", "cvssV4_0", "cvssV2_0"]:
                    if k in m:
                        cvss = m[k]
                        cvss_score = cvss.get("baseScore")
                        cvss_vector = cvss.get("vectorString")
                        severity = cvss.get("baseSeverity")
                        break
                if cvss_score is not None:
                    break

            batch.append((
                cve_id, title, desc, severity, cvss_score, cvss_vector,
                cwe_id, pub_date, upd_date
            ))
            count += 1

            if len(batch) >= 2000:
                with conn:
                    cursor.executemany("""
                        INSERT INTO cves (
                            cve_id, title, description, severity, cvss_score,
                            cvss_vector, cwe_id, published_at, updated_at, sources
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'cvelist_v5')
                        ON CONFLICT(cve_id) DO UPDATE SET
                            title = COALESCE(excluded.title, cves.title),
                            description = COALESCE(excluded.description, cves.description),
                            severity = COALESCE(excluded.severity, cves.severity),
                            cvss_score = COALESCE(excluded.cvss_score, cves.cvss_score),
                            cvss_vector = COALESCE(excluded.cvss_vector, cves.cvss_vector),
                            cwe_id = COALESCE(excluded.cwe_id, cves.cwe_id),
                            published_at = COALESCE(excluded.published_at, cves.published_at),
                            updated_at = COALESCE(excluded.updated_at, cves.updated_at),
                            sources = CASE 
                                WHEN cves.sources NOT LIKE '%cvelist_v5%' THEN cves.sources || ',cvelist_v5' 
                                ELSE cves.sources 
                            END;
                    """, batch)
                batch.clear()
                print(f"    Indexed {count:,} / {total_files:,} records...", end="\r", flush=True)

    if batch:
        with conn:
            cursor.executemany("""
                INSERT INTO cves (
                    cve_id, title, description, severity, cvss_score,
                    cvss_vector, cwe_id, published_at, updated_at, sources
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'cvelist_v5')
                ON CONFLICT(cve_id) DO UPDATE SET
                    title = COALESCE(excluded.title, cves.title),
                    description = COALESCE(excluded.description, cves.description),
                    severity = COALESCE(excluded.severity, cves.severity),
                    cvss_score = COALESCE(excluded.cvss_score, cves.cvss_score),
                    cvss_vector = COALESCE(excluded.cvss_vector, cves.cvss_vector),
                    cwe_id = COALESCE(excluded.cwe_id, cves.cwe_id),
                    published_at = COALESCE(excluded.published_at, cves.published_at),
                    updated_at = COALESCE(excluded.updated_at, cves.updated_at),
                    sources = CASE 
                        WHEN cves.sources NOT LIKE '%cvelist_v5%' THEN cves.sources || ',cvelist_v5' 
                        ELSE cves.sources 
                    END;
            """, batch)

    print(f"\n[+] CVE List v5 sync complete: {count:,} records indexed.")
    return count


def enrich_nvd(conn, cve_id):
    cve_id = cve_id.strip().upper()
    url = f"{URLS['nvd_api']}?cveId={cve_id}"
    print(f"[*] Querying NVD API 2.0 for {cve_id}...")
    try:
        with http_get(url, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[!] NVD API query failed: {e}")
        return None

    vulns = data.get("vulnerabilities", [])
    if not vulns:
        print(f"[!] No record found in NVD for {cve_id}")
        return None

    cve = vulns[0].get("cve", {})
    desc = ""
    for d in cve.get("descriptions", []):
        if d.get("lang") == "en":
            desc = d.get("value")
            break

    cvss_score = None
    cvss_vector = None
    severity = None
    metrics = cve.get("metrics", {})

    for k in ["cvssMetricV31", "cvssMetricV30", "cvssMetricV40", "cvssMetricV2"]:
        if k in metrics and metrics[k]:
            data_m = metrics[k][0].get("cvssData", {})
            cvss_score = data_m.get("baseScore")
            cvss_vector = data_m.get("vectorString")
            severity = data_m.get("baseSeverity") or metrics[k][0].get("baseSeverity")
            break

    cwe_id = None
    for w in cve.get("weaknesses", []):
        for d in w.get("description", []):
            val = d.get("value")
            if val and "CWE-" in val:
                cwe_id = val
                break
        if cwe_id:
            break

    pub_date = cve.get("published")
    upd_date = cve.get("lastModified")

    with conn:
        conn.execute("""
            INSERT INTO cves (
                cve_id, description, severity, cvss_score,
                cvss_vector, cwe_id, published_at, updated_at, sources, raw_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'nvd', ?)
            ON CONFLICT(cve_id) DO UPDATE SET
                description = COALESCE(excluded.description, cves.description),
                severity = COALESCE(excluded.severity, cves.severity),
                cvss_score = COALESCE(excluded.cvss_score, cves.cvss_score),
                cvss_vector = COALESCE(excluded.cvss_vector, cves.cvss_vector),
                cwe_id = COALESCE(excluded.cwe_id, cves.cwe_id),
                published_at = COALESCE(excluded.published_at, cves.published_at),
                updated_at = COALESCE(excluded.updated_at, cves.updated_at),
                sources = CASE 
                    WHEN cves.sources NOT LIKE '%nvd%' THEN cves.sources || ',nvd' 
                    ELSE cves.sources 
                END,
                raw_json = excluded.raw_json;
        """, (cve_id, desc, severity, cvss_score, cvss_vector, cwe_id, pub_date, upd_date, json.dumps(cve)))

    print(f"[+] Successfully enriched {cve_id} from NVD (CVSS: {cvss_score}, CWE: {cwe_id}).")
    return cve_id


def query_cve(conn, cve_id, enrich_if_missing=True):
    cve_id = cve_id.strip().upper()
    row = conn.execute("SELECT * FROM cves WHERE cve_id = ?", (cve_id,)).fetchone()

    if (not row or (enrich_if_missing and (not row["description"] or row["cvss_score"] is None))) and not os.environ.get("NO_NVD"):
        enrich_nvd(conn, cve_id)
        row = conn.execute("SELECT * FROM cves WHERE cve_id = ?", (cve_id,)).fetchone()

    if not row:
        print(f"\n[!] CVE not found: {cve_id}")
        return

    osv_rows = conn.execute("SELECT * FROM osv_advisories WHERE cve_id = ?", (cve_id,)).fetchall()

    print("\n" + "=" * 70)
    print(f"  CVE ID:       {row['cve_id']}")
    if row["title"]:
        print(f"  Title:        {row['title']}")
    print(f"  Severity:     {row['severity'] or 'Unknown'} (CVSS: {row['cvss_score'] or 'N/A'})")
    if row["cvss_vector"]:
        print(f"  Vector:       {row['cvss_vector']}")
    if row["cwe_id"]:
        print(f"  CWE:          {row['cwe_id']}")
    print(f"  Sources:      {row['sources'] or 'N/A'}")
    print("-" * 70)

    # CISA KEV Exploitation
    if row["is_kev"]:
        print("  [!] CISA KEV:  ACTIVELY EXPLOITED IN THE WILD")
        print(f"      Vendor:   {row['kev_vendor']} / Product: {row['kev_product']}")
        print(f"      Added:    {row['kev_date_added']} | Due: {row['kev_due_date']}")
        print(f"      Ransomware Campaign Use: {row['kev_ransomware']}")
    else:
        print("  CISA KEV:     No (Not listed in CISA known exploited catalog)")

    # EPSS Score
    if row["epss_score"] is not None:
        pct = row["epss_percentile"] * 100.0 if row["epss_percentile"] is not None else 0
        prob = row["epss_score"] * 100.0
        print(f"  EPSS Score:   {prob:.3f}% exploit probability ({pct:.1f}th percentile)")
    else:
        print("  EPSS Score:   N/A")

    if row["published_at"]:
        print(f"  Published:    {row['published_at']}")

    print("-" * 70)
    print("  Description:")
    desc = row["description"] or "No description available."
    for line in desc.split("\n"):
        print(f"    {line}")

    if osv_rows:
        print("-" * 70)
        print(f"  Open Source Ecosystem Advisories ({len(osv_rows)} found):")
        for adv in osv_rows:
            pkg = adv["package_name"] or "unknown"
            eco = adv["ecosystem"] or "unknown"
            print(f"    - [{adv['id']}] {eco} package '{pkg}': {adv['summary'] or adv['details'][:80] if adv['details'] else 'Advisory logged'}")

    print("=" * 70 + "\n")


def search_cves(conn, term, kev_only=False, min_epss=None, min_cvss=None, cwe=None, severity=None, limit=20):
    query = """
        SELECT cves.cve_id, cves.title, cves.severity, cves.cvss_score, cves.epss_score, 
               cves.epss_percentile, cves.is_kev, cves.cwe_id, cves.description
        FROM cves
    """
    conditions = []
    params = []

    if term:
        query += " JOIN cves_fts ON cves.rowid = cves_fts.rowid "
        conditions.append("cves_fts MATCH ?")
        params.append(term)

    if kev_only:
        conditions.append("cves.is_kev = 1")

    if min_epss is not None:
        conditions.append("cves.epss_score >= ?")
        params.append(min_epss)

    if min_cvss is not None:
        conditions.append("cves.cvss_score >= ?")
        params.append(min_cvss)

    if cwe:
        conditions.append("cves.cwe_id LIKE ?")
        params.append(f"%{cwe}%")

    if severity:
        conditions.append("LOWER(cves.severity) = LOWER(?)")
        params.append(severity)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY cves.is_kev DESC, cves.epss_score DESC, cves.cvss_score DESC LIMIT ?"
    params.append(limit)

    rows = conn.execute(query, params).fetchall()
    print(f"\n[*] Found {len(rows)} matching CVEs:\n")
    print(f"{'CVE ID':<16} {'KEV':<5} {'EPSS':<8} {'CVSS':<6} {'SEV':<10} {'CWE':<10} {'SUMMARY'}")
    print("-" * 90)

    for r in rows:
        kev = "YES" if r["is_kev"] else "no"
        epss_str = f"{r['epss_score']*100:.1f}%" if r["epss_score"] is not None else "-"
        cvss_str = f"{r['cvss_score']:.1f}" if r["cvss_score"] is not None else "-"
        sev = r["severity"] or "-"
        cwe_s = r["cwe_id"] or "-"
        title = r["title"] or r["description"] or ""
        title_trunc = (title[:45] + "...") if len(title) > 45 else title
        print(f"{r['cve_id']:<16} {kev:<5} {epss_str:<8} {cvss_str:<6} {sev:<10} {cwe_s:<10} {title_trunc}")
    print()


def show_stats(conn):
    total = conn.execute("SELECT COUNT(*) FROM cves;").fetchone()[0]
    kev_count = conn.execute("SELECT COUNT(*) FROM cves WHERE is_kev = 1;").fetchone()[0]
    epss_count = conn.execute("SELECT COUNT(*) FROM cves WHERE epss_score IS NOT NULL;").fetchone()[0]
    cvss_count = conn.execute("SELECT COUNT(*) FROM cves WHERE cvss_score IS NOT NULL;").fetchone()[0]
    osv_count = conn.execute("SELECT COUNT(*) FROM osv_advisories;").fetchone()[0]

    sev_rows = conn.execute("""
        SELECT COALESCE(severity, 'UNKNOWN') as sev, COUNT(*) as cnt 
        FROM cves GROUP BY sev ORDER BY cnt DESC;
    """).fetchall()

    print("\n==============================================")
    print("       BountyOS CVE Intelligence Database")
    print("==============================================")
    print(f"  Database Path:      {DB_PATH}")
    db_size = os.path.getsize(DB_PATH) / (1024 * 1024) if os.path.exists(DB_PATH) else 0
    print(f"  Database Size:      {db_size:.2f} MB")
    print(f"  Total CVE Records:  {total:,}")
    print(f"  CISA KEV Exploits:  {kev_count:,}")
    print(f"  EPSS Scored CVEs:   {epss_count:,}")
    print(f"  CVSS Scored CVEs:   {cvss_count:,}")
    print(f"  OSV Open Source:    {osv_count:,} advisories")
    print("----------------------------------------------")
    print("  Severity Breakdown:")
    for row in sev_rows:
        print(f"    {row['sev']:<12}: {row['cnt']:,}")
    print("==============================================\n")


def show_top_epss(conn, limit=20):
    rows = conn.execute("""
        SELECT cve_id, title, severity, cvss_score, epss_score, epss_percentile, is_kev, cwe_id
        FROM cves
        WHERE epss_score IS NOT NULL
        ORDER BY epss_score DESC LIMIT ?;
    """, (limit,)).fetchall()

    print(f"\n[*] Top {limit} Highest Exploit Probability Vulnerabilities (EPSS):\n")
    print(f"{'CVE ID':<16} {'KEV':<5} {'EPSS':<9} {'PERCENTILE':<12} {'CVSS':<6} {'SEVERITY':<10} {'TITLE'}")
    print("-" * 95)
    for r in rows:
        kev = "YES" if r["is_kev"] else "no"
        epss_str = f"{r['epss_score']*100:.2f}%"
        pct_str = f"{r['epss_percentile']*100:.1f}th" if r["epss_percentile"] else "-"
        cvss_str = f"{r['cvss_score']:.1f}" if r["cvss_score"] else "-"
        title = r["title"] or ""
        print(f"{r['cve_id']:<16} {kev:<5} {epss_str:<9} {pct_str:<12} {cvss_str:<6} {r['severity'] or '-':<10} {title[:40]}")
    print()


def show_kev(conn, limit=25):
    rows = conn.execute("""
        SELECT cve_id, kev_vendor, kev_product, title, kev_date_added, kev_ransomware, epss_score
        FROM cves
        WHERE is_kev = 1
        ORDER BY kev_date_added DESC LIMIT ?;
    """, (limit,)).fetchall()

    print(f"\n[*] CISA Known Exploited Vulnerabilities (Latest {limit}):\n")
    print(f"{'CVE ID':<16} {'ADDED':<12} {'VENDOR/PRODUCT':<25} {'RANSOMWARE':<12} {'EPSS':<8} {'TITLE'}")
    print("-" * 100)
    for r in rows:
        vp = f"{r['kev_vendor'] or ''}/{r['kev_product'] or ''}"[:24]
        rw = r["kev_ransomware"] or "Unknown"
        epss = f"{r['epss_score']*100:.1f}%" if r["epss_score"] else "-"
        title = r["title"] or ""
        print(f"{r['cve_id']:<16} {r['kev_date_added'] or '-':<12} {vp:<25} {rw:<12} {epss:<8} {title[:30]}")
    print()


def export_jsonl(conn, out_path, kev_only=False):
    query = "SELECT * FROM cves"
    if kev_only:
        query += " WHERE is_kev = 1"

    cursor = conn.execute(query)
    count = 0
    with open(out_path, "w", encoding="utf-8") as f:
        for row in cursor:
            f.write(json.dumps(dict(row)) + "\n")
            count += 1
    print(f"[+] Exported {count:,} CVE records to {out_path}")


def main():
    parser = argparse.ArgumentParser(
        description="BountyOS Open-Source CVE & Threat Intelligence Database Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # sync
    sync_p = subparsers.add_parser("sync", help="Synchronize open source vulnerability databases")
    sync_p.add_argument("--all", action="store_true", help="Sync all feeds (KEV, EPSS, OSV, CVEList)")
    sync_p.add_argument("--kev", action="store_true", help="Sync CISA Known Exploited Vulnerabilities")
    sync_p.add_argument("--epss", action="store_true", help="Sync EPSS exploit probability scores")
    sync_p.add_argument("--osv", action="store_true", help="Sync OSV.dev open source advisories")
    sync_p.add_argument("--cvelist", action="store_true", help="Sync CVE Project List v5 (daily delta)")
    sync_p.add_argument("--cvelist-all", action="store_true", help="Sync full CVE Project List v5 (all historical CVEs)")

    # get
    get_p = subparsers.add_parser("get", help="Query and enrich a specific CVE")
    get_p.add_argument("cve_id", help="CVE identifier (e.g. CVE-2024-3094)")

    # search
    search_p = subparsers.add_parser("search", help="Full-text and filtered search")
    search_p.add_argument("query", nargs="?", default="", help="Search keywords (e.g. 'injection', 'openssh', 'Cisco')")
    search_p.add_argument("--kev", action="store_true", help="Only actively exploited (CISA KEV)")
    search_p.add_argument("--min-epss", type=float, help="Minimum EPSS probability (0.0 to 1.0)")
    search_p.add_argument("--min-cvss", type=float, help="Minimum CVSS base score (0.0 to 10.0)")
    search_p.add_argument("--cwe", help="Filter by CWE (e.g. CWE-78)")
    search_p.add_argument("--severity", help="Filter by severity (CRITICAL, HIGH, etc.)")
    search_p.add_argument("--limit", type=int, default=20, help="Results limit")

    # kev
    kev_p = subparsers.add_parser("kev", help="Show actively exploited vulnerabilities (CISA KEV)")
    kev_p.add_argument("--limit", type=int, default=25, help="Number of records to show")

    # top-epss
    top_p = subparsers.add_parser("top-epss", help="Show top exploit-probability vulnerabilities")
    top_p.add_argument("--limit", type=int, default=20, help="Number of records to show")

    # stats
    subparsers.add_parser("stats", help="Show database metrics and coverage")

    # export
    exp_p = subparsers.add_parser("export", help="Export CVE database to JSONL")
    exp_p.add_argument("file", help="Output path (e.g. data/cves_export.jsonl)")
    exp_p.add_argument("--kev-only", action="store_true", help="Only export KEV records")

    args = parser.parse_args()

    conn = get_db()
    init_db(conn)

    if args.command == "sync":
        do_all = args.all or not (args.kev or args.epss or args.osv or args.cvelist or args.cvelist_all)
        if do_all or args.kev:
            sync_cisa_kev(conn)
        if do_all or args.epss:
            sync_epss(conn)
        if do_all or args.osv:
            sync_osv(conn)
        if do_all or args.cvelist:
            sync_cvelist(conn, mode="delta")
        elif args.cvelist_all:
            sync_cvelist(conn, mode="all")
        show_stats(conn)

    elif args.command == "get":
        query_cve(conn, args.cve_id)

    elif args.command == "search":
        search_cves(
            conn,
            args.query,
            kev_only=args.kev,
            min_epss=args.min_epss,
            min_cvss=args.min_cvss,
            cwe=args.cwe,
            severity=args.severity,
            limit=args.limit,
        )

    elif args.command == "kev":
        show_kev(conn, limit=args.limit)

    elif args.command == "top-epss":
        show_top_epss(conn, limit=args.limit)

    elif args.command == "stats":
        show_stats(conn)

    elif args.command == "export":
        export_jsonl(conn, args.file, kev_only=args.kev_only)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
