#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "google-analytics-data",
# ]
# ///
"""
Google Analytics 4 query CLI.

Usage:
    uv run ga_query.py --report overview --days 30
    uv run ga_query.py --report pages --days 7 --limit 20 --output json
    uv run ga_query.py --report sources --days 30
    uv run ga_query.py --report realtime
    uv run ga_query.py --report custom --metrics "sessions,totalUsers" --dimensions "city" --days 7
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta

# ── Config ──────────────────────────────────────────────────────────────────
CREDENTIALS_PATH = os.environ.get("GA4_CREDENTIALS", "YOUR_CREDENTIALS_PATH_HERE")
PROPERTY_ID      = os.environ.get("GA4_PROPERTY_ID", "YOUR_PROPERTY_ID_HERE")
# ────────────────────────────────────────────────────────────────────────────


def get_client(realtime=False):
    if CREDENTIALS_PATH == "YOUR_CREDENTIALS_PATH_HERE":
        print("Error: set GA4_CREDENTIALS env var or edit CREDENTIALS_PATH in script", file=sys.stderr)
        sys.exit(1)
    if not realtime and PROPERTY_ID == "YOUR_PROPERTY_ID_HERE":
        print("Error: set GA4_PROPERTY_ID env var or edit PROPERTY_ID in script", file=sys.stderr)
        sys.exit(1)

    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = CREDENTIALS_PATH

    if realtime:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        return BetaAnalyticsDataClient()
    else:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        return BetaAnalyticsDataClient()


def date_range(days, start=None, end=None):
    from google.analytics.data_v1beta.types import DateRange
    if start and end:
        return DateRange(start_date=start, end_date=end)
    end_dt = datetime.today().strftime("%Y-%m-%d")
    start_dt = (datetime.today() - timedelta(days=days)).strftime("%Y-%m-%d")
    return DateRange(start_date=start_dt, end_date=end_dt)


def metric(name):
    from google.analytics.data_v1beta.types import Metric
    return Metric(name=name)


def dimension(name):
    from google.analytics.data_v1beta.types import Dimension
    return Dimension(name=name)


def order_by_metric(name, desc=True):
    from google.analytics.data_v1beta.types import OrderBy
    return OrderBy(metric=OrderBy.MetricOrderBy(metric_name=name), desc=desc)


def run_report(client, metrics, dimensions, date_range_obj, limit=10, order=None):
    from google.analytics.data_v1beta.types import RunReportRequest
    req = RunReportRequest(
        property=f"properties/{PROPERTY_ID}",
        metrics=[metric(m) for m in metrics],
        dimensions=[dimension(d) for d in dimensions],
        date_ranges=[date_range_obj],
        limit=limit,
    )
    if order:
        req.order_bys = order
    return client.run_report(req)


def parse_response(response, metric_names, dimension_names):
    rows = []
    for row in response.rows:
        r = {}
        for i, d in enumerate(dimension_names):
            r[d] = row.dimension_values[i].value
        for i, m in enumerate(metric_names):
            val = row.metric_values[i].value
            try:
                r[m] = float(val) if "." in val else int(val)
            except ValueError:
                r[m] = val
        rows.append(r)
    return rows


def format_output(rows, fmt):
    if not rows:
        print("No data returned.")
        return

    if fmt == "json":
        print(json.dumps(rows, indent=2, ensure_ascii=False))
        return

    if fmt == "csv":
        keys = list(rows[0].keys())
        print(",".join(keys))
        for r in rows:
            print(",".join(str(r.get(k, "")) for k in keys))
        return

    # table
    if not rows:
        return
    keys = list(rows[0].keys())
    widths = {k: max(len(k), max(len(str(r.get(k, ""))) for r in rows)) for k in keys}
    header = "  ".join(k.ljust(widths[k]) for k in keys)
    sep    = "  ".join("-" * widths[k] for k in keys)
    print(header)
    print(sep)
    for r in rows:
        print("  ".join(str(r.get(k, "")).ljust(widths[k]) for k in keys))


# ── Reports ──────────────────────────────────────────────────────────────────

def report_overview(client, dr, limit, fmt):
    metrics = ["totalUsers", "newUsers", "sessions", "screenPageViews",
               "averageSessionDuration", "bounceRate"]
    dimensions = ["date"]
    # summary — aggregate, no dimension grouping
    from google.analytics.data_v1beta.types import RunReportRequest
    req = RunReportRequest(
        property=f"properties/{PROPERTY_ID}",
        metrics=[metric(m) for m in metrics],
        date_ranges=[dr],
        limit=1,
    )
    resp = client.run_report(req)
    if not resp.rows:
        print("No data.")
        return
    row = resp.rows[0]
    data = {}
    for i, m in enumerate(metrics):
        val = row.metric_values[i].value
        try:
            data[m] = float(val) if "." in val else int(val)
        except ValueError:
            data[m] = val
    rows = [data]
    format_output(rows, fmt)


def report_pages(client, dr, limit, fmt):
    metrics = ["screenPageViews", "totalUsers", "averageSessionDuration"]
    dimensions = ["pagePath", "pageTitle"]
    resp = run_report(client, metrics, dimensions, dr, limit,
                      order=[order_by_metric("screenPageViews")])
    rows = parse_response(resp, metrics, dimensions)
    format_output(rows, fmt)


def report_sources(client, dr, limit, fmt):
    metrics = ["sessions", "totalUsers", "conversions"]
    dimensions = ["sessionSource", "sessionMedium"]
    resp = run_report(client, metrics, dimensions, dr, limit,
                      order=[order_by_metric("sessions")])
    rows = parse_response(resp, metrics, dimensions)
    format_output(rows, fmt)


def report_countries(client, dr, limit, fmt):
    metrics = ["sessions", "totalUsers", "engagementRate"]
    dimensions = ["country"]
    resp = run_report(client, metrics, dimensions, dr, limit,
                      order=[order_by_metric("sessions")])
    rows = parse_response(resp, metrics, dimensions)
    format_output(rows, fmt)


def report_devices(client, dr, limit, fmt):
    metrics = ["sessions", "totalUsers"]
    dimensions = ["deviceCategory"]
    resp = run_report(client, metrics, dimensions, dr, limit,
                      order=[order_by_metric("sessions")])
    rows = parse_response(resp, metrics, dimensions)
    format_output(rows, fmt)


def report_daily(client, dr, limit, fmt):
    metrics = ["totalUsers", "sessions", "screenPageViews"]
    dimensions = ["date"]
    from google.analytics.data_v1beta.types import OrderBy, RunReportRequest
    req = RunReportRequest(
        property=f"properties/{PROPERTY_ID}",
        metrics=[metric(m) for m in metrics],
        dimensions=[dimension(d) for d in dimensions],
        date_ranges=[dr],
        limit=limit,
        order_bys=[OrderBy(dimension=OrderBy.DimensionOrderBy(dimension_name="date"), desc=False)],
    )
    resp = client.run_report(req)
    rows = parse_response(resp, metrics, dimensions)
    format_output(rows, fmt)


def report_realtime(client, fmt):
    from google.analytics.data_v1beta.types import (
        Dimension, Metric, RunRealtimeReportRequest,
    )
    req = RunRealtimeReportRequest(
        property=f"properties/{PROPERTY_ID}",
        metrics=[Metric(name="activeUsers")],
        dimensions=[Dimension(name="unifiedScreenName"),
                    Dimension(name="sessionSource")],
    )
    resp = client.run_realtime_report(req)
    rows = []
    for row in resp.rows:
        rows.append({
            "page":   row.dimension_values[0].value,
            "source": row.dimension_values[1].value,
            "activeUsers": int(row.metric_values[0].value),
        })
    format_output(rows, fmt)


def report_custom(client, dr, metrics_str, dimensions_str, limit, fmt):
    metrics    = [m.strip() for m in metrics_str.split(",")]
    dimensions = [d.strip() for d in dimensions_str.split(",")] if dimensions_str else []
    resp = run_report(client, metrics, dimensions, dr, limit,
                      order=[order_by_metric(metrics[0])])
    rows = parse_response(resp, metrics, dimensions)
    format_output(rows, fmt)


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="GA4 query CLI")
    parser.add_argument("--report", required=True,
                        choices=["overview", "pages", "sources", "countries",
                                 "devices", "daily", "realtime", "custom"])
    parser.add_argument("--days",       type=int,   default=30)
    parser.add_argument("--limit",      type=int,   default=10)
    parser.add_argument("--start",      default=None)
    parser.add_argument("--end",        default=None)
    parser.add_argument("--output",     default="table", choices=["table", "json", "csv"])
    parser.add_argument("--metrics",    default=None, help="Comma-separated metric names (custom report)")
    parser.add_argument("--dimensions", default=None, help="Comma-separated dimension names (custom report)")
    args = parser.parse_args()

    is_realtime = args.report == "realtime"
    client = get_client(realtime=is_realtime)
    dr = date_range(args.days, args.start, args.end)

    if args.report == "overview":
        report_overview(client, dr, args.limit, args.output)
    elif args.report == "pages":
        report_pages(client, dr, args.limit, args.output)
    elif args.report == "sources":
        report_sources(client, dr, args.limit, args.output)
    elif args.report == "countries":
        report_countries(client, dr, args.limit, args.output)
    elif args.report == "devices":
        report_devices(client, dr, args.limit, args.output)
    elif args.report == "daily":
        report_daily(client, dr, args.limit, args.output)
    elif args.report == "realtime":
        report_realtime(client, args.output)
    elif args.report == "custom":
        if not args.metrics:
            print("Error: --metrics required for custom report", file=sys.stderr)
            sys.exit(1)
        report_custom(client, dr, args.metrics, args.dimensions, args.limit, args.output)


if __name__ == "__main__":
    main()
