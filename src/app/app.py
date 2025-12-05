from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pymongo import MongoClient
from bson import ObjectId
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "ema")

client = MongoClient(MONGO_URI)
db = client[MONGO_DB]

app = FastAPI(title="Procure Match")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")


def _serialize_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    doc = dict(doc)
    if "_id" in doc and isinstance(doc["_id"], ObjectId):
        doc["_id"] = str(doc["_id"])
    return doc


@app.get("/api/invoices")
async def list_invoices() -> List[Dict[str, Any]]:
    coll = db["invoices"]
    docs = [
        _serialize_doc(doc)
        for doc in coll.find().sort("invoice.invoice_number")
    ]
    return docs


@app.get("/api/purchase_orders")
async def list_purchase_orders() -> List[Dict[str, Any]]:
    coll = db["purchase_orders"]
    docs = [
        _serialize_doc(doc)
        for doc in coll.find().sort("purchase_order.po_number")
    ]
    return docs


@app.get("/api/goods_receipts")
async def list_goods_receipts() -> List[Dict[str, Any]]:
    coll = db["goods_receipts"]
    docs = [
        _serialize_doc(doc)
        for doc in coll.find().sort("goods_receipt.grn_number")
    ]
    return docs


@app.get("/api/reconciliation")
async def reconciliation() -> List[Dict[str, Any]]:
    po_coll = db["purchase_orders"]
    inv_coll = db["invoices"]
    grn_coll = db["goods_receipts"]
    decision_coll = db["reconciliation_decisions"]

    results: List[Dict[str, Any]] = []
    processed_po_numbers = set()

    # Process all POs and their linked documents
    for po in po_coll.find():
        po_s = _serialize_doc(po)
        po_data = po_s.get("purchase_order") or {}
        po_number = po_data.get("po_number")
        if not po_number:
            continue

        processed_po_numbers.add(po_number)

        invoices = [
            _serialize_doc(d)
            for d in inv_coll.find({"invoice.reference_po": po_number})
        ]
        grns = [
            _serialize_doc(d)
            for d in grn_coll.find({"goods_receipt.reference_po": po_number})
        ]

        status = "matched"
        issues: List[str] = []

        if not invoices:
            status = "missing_invoice"
            issues.append("No invoice found for this PO")
        if not grns:
            status = "missing_goods_receipt" if status == "matched" else status
            issues.append("No goods receipt found for this PO")

        inv_totals = [
            (d.get("invoice") or {}).get("grand_total")
            for d in invoices
        ]
        inv_totals = [t for t in inv_totals if t is not None]

        po_total = po_data.get("grand_total")
        if po_total is not None and inv_totals:
            for t in inv_totals:
                if abs(t - po_total) > 0.01:
                    if status == "matched":
                        status = "amount_mismatch"
                    issues.append(
                        f"Invoice grand_total {t} does not match PO grand_total {po_total}"
                    )

        # Check for existing decision
        decision_doc = decision_coll.find_one({"po_number": po_number})
        decision_info = None
        if decision_doc:
            decision_info = {
                "decision": decision_doc.get("decision"),
                "comment": decision_doc.get("comment", ""),
                "timestamp": decision_doc.get("timestamp"),
                "user": decision_doc.get("user")
            }

        result = {
            "po": po_s,
            "invoices": invoices,
            "goods_receipts": grns,
            "status": status,
            "issues": issues,
            "decision": decision_info,
        }
        results.append(result)

    # Find orphaned invoices (invoices without matching PO)
    for inv in inv_coll.find():
        inv_s = _serialize_doc(inv)
        inv_data = inv_s.get("invoice") or {}
        ref_po = inv_data.get("reference_po")
        
        # If invoice references a PO that doesn't exist or wasn't processed
        if ref_po and ref_po not in processed_po_numbers:
            # Check if this PO actually exists
            po_exists = po_coll.find_one({"purchase_order.po_number": ref_po})
            if not po_exists:
                # Ghost invoice - references non-existent PO
                grns = [
                    _serialize_doc(d)
                    for d in grn_coll.find({"goods_receipt.reference_po": ref_po})
                ]
                
                result = {
                    "po": {"purchase_order": {"po_number": ref_po, "vendor": {"name": "Unknown"}}},
                    "invoices": [inv_s],
                    "goods_receipts": grns,
                    "status": "ghost_po",
                    "issues": [f"Invoice references non-existent PO: {ref_po}"],
                    "decision": None,
                }
                results.append(result)
                processed_po_numbers.add(ref_po)
        elif not ref_po:
            # Invoice with no PO reference at all
            result = {
                "po": {"purchase_order": {"po_number": inv_data.get("invoice_number", "Unknown"), "vendor": {"name": inv_data.get("vendor", {}).get("name", "Unknown")}}},
                "invoices": [inv_s],
                "goods_receipts": [],
                "status": "orphaned_invoice",
                "issues": ["Invoice has no PO reference"],
                "decision": None,
            }
            results.append(result)

    # Find orphaned GRNs (GRNs without matching PO)
    for grn in grn_coll.find():
        grn_s = _serialize_doc(grn)
        grn_data = grn_s.get("goods_receipt") or {}
        ref_po = grn_data.get("reference_po")
        
        # If GRN references a PO that doesn't exist or wasn't processed
        if ref_po and ref_po not in processed_po_numbers:
            po_exists = po_coll.find_one({"purchase_order.po_number": ref_po})
            if not po_exists:
                # Ghost GRN - references non-existent PO
                result = {
                    "po": {"purchase_order": {"po_number": ref_po, "vendor": {"name": "Unknown"}}},
                    "invoices": [],
                    "goods_receipts": [grn_s],
                    "status": "ghost_po",
                    "issues": [f"GRN references non-existent PO: {ref_po}"],
                    "decision": None,
                }
                results.append(result)
                processed_po_numbers.add(ref_po)
        elif not ref_po:
            # GRN with no PO reference
            result = {
                "po": {"purchase_order": {"po_number": grn_data.get("grn_number", "Unknown"), "vendor": {"name": grn_data.get("vendor", {}).get("name", "Unknown")}}},
                "invoices": [],
                "goods_receipts": [grn_s],
                "status": "orphaned_grn",
                "issues": ["GRN has no PO reference"],
                "decision": None,
            }
            results.append(result)

    return results


@app.get("/api/pdf")
async def get_pdf(path: str):
    pdf_path = Path(path)
    if not pdf_path.is_file():
        raise HTTPException(status_code=404, detail="PDF not found")
    if pdf_path.suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="Not a PDF file")
    return FileResponse(pdf_path)


@app.get("/")
async def root():
    index_path = BASE_DIR / "static" / "index.html"
    if not index_path.is_file():
        raise HTTPException(status_code=500, detail="UI not found")
    return FileResponse(index_path)


class ReconciliationDecision(BaseModel):
    po_number: str
    decision: str  # "approved" or "rejected"
    comment: str = ""


@app.post("/api/reconciliation/decision")
async def save_reconciliation_decision(decision: ReconciliationDecision) -> Dict[str, Any]:
    """Save approval or rejection decision for a reconciliation record."""
    if decision.decision not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Decision must be 'approved' or 'rejected'")
    
    # Create or update reconciliation decision record
    reconciliation_coll = db["reconciliation_decisions"]
    
    decision_record = {
        "po_number": decision.po_number,
        "decision": decision.decision,
        "comment": decision.comment,
        "timestamp": datetime.utcnow().isoformat(),
        "user": "JA"  # In production, get from auth context
    }
    
    # Upsert: update if exists, insert if not
    result = reconciliation_coll.update_one(
        {"po_number": decision.po_number},
        {"$set": decision_record},
        upsert=True
    )
    
    return {
        "success": True,
        "po_number": decision.po_number,
        "decision": decision.decision,
        "matched": result.matched_count,
        "modified": result.modified_count,
        "upserted_id": str(result.upserted_id) if result.upserted_id else None
    }
