"""Issues/Incidents routes"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone
from models import Issue, CreateIssueRequest, UpdateIssueRequest
from utils import db, get_current_user, serialize_doc

router = APIRouter(prefix="/issues", tags=["Issues"])


@router.get("")
async def get_issues(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    issue_type: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    driver_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"company_id": current_user["company_id"]}
    if status:
        query["status"] = status
    if severity:
        query["severity"] = severity
    if issue_type:
        query["issue_type"] = issue_type
    if vehicle_id:
        query["vehicle_id"] = vehicle_id
    if driver_id:
        query["driver_id"] = driver_id
    
    # If driver, only show their issues
    if current_user["role"] == "chofer":
        query["driver_id"] = current_user["id"]
    
    issues = await db.issues.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [serialize_doc(i) for i in issues]


@router.get("/{issue_id}")
async def get_issue(issue_id: str, current_user: dict = Depends(get_current_user)):
    issue = await db.issues.find_one(
        {"id": issue_id, "company_id": current_user["company_id"]},
        {"_id": 0}
    )
    if not issue:
        raise HTTPException(status_code=404, detail="Incidente no encontrado")
    return serialize_doc(issue)


@router.post("")
async def create_issue(request: CreateIssueRequest, current_user: dict = Depends(get_current_user)):
    # Generate issue number
    count = await db.issues.count_documents({"company_id": current_user["company_id"]})
    issue_number = f"INC-{count + 1:05d}"
    
    issue = Issue(
        company_id=current_user["company_id"],
        issue_number=issue_number,
        trip_id=request.trip_id,
        vehicle_id=request.vehicle_id,
        driver_id=request.driver_id or (current_user["id"] if current_user["role"] == "chofer" else None),
        issue_type=request.issue_type,
        severity=request.severity,
        title=request.title,
        description=request.description,
        location=request.location,
        photos=request.photos,
        cost=request.cost,
        created_by=current_user["id"]
    )
    
    doc = issue.model_dump()
    for key, value in doc.items():
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
    
    await db.issues.insert_one(doc)
    return {"id": issue.id, "issue_number": issue_number, "message": "Incidente creado exitosamente"}


@router.put("/{issue_id}")
async def update_issue(issue_id: str, request: UpdateIssueRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin", "operaciones", "flota"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    issue = await db.issues.find_one({"id": issue_id, "company_id": current_user["company_id"]})
    if not issue:
        raise HTTPException(status_code=404, detail="Incidente no encontrado")
    
    update_data = {}
    if request.status is not None:
        update_data["status"] = request.status
        if request.status == "cerrado":
            update_data["resolved_by"] = current_user["id"]
            update_data["resolved_at"] = datetime.now(timezone.utc).isoformat()
    if request.severity is not None:
        update_data["severity"] = request.severity
    if request.resolution is not None:
        update_data["resolution"] = request.resolution
    if request.responsible is not None:
        update_data["responsible"] = request.responsible
    if request.cost is not None:
        update_data["cost"] = request.cost
    if request.work_order_id is not None:
        update_data["work_order_id"] = request.work_order_id
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.issues.update_one({"id": issue_id}, {"$set": update_data})
    return {"message": "Incidente actualizado"}


@router.post("/{issue_id}/resolve")
async def resolve_issue(issue_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin", "operaciones", "flota"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    await db.issues.update_one(
        {"id": issue_id, "company_id": current_user["company_id"]},
        {"$set": {
            "status": "cerrado",
            "resolution": request.get("resolution", ""),
            "resolved_by": current_user["id"],
            "resolved_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Incidente resuelto"}


@router.get("/stats/summary")
async def get_issues_summary(current_user: dict = Depends(get_current_user)):
    company_id = current_user["company_id"]
    
    pipeline = [
        {"$match": {"company_id": company_id}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_cost": {"$sum": "$cost"}
        }}
    ]
    
    status_stats = await db.issues.aggregate(pipeline).to_list(10)
    
    severity_pipeline = [
        {"$match": {"company_id": company_id, "status": {"$ne": "cerrado"}}},
        {"$group": {
            "_id": "$severity",
            "count": {"$sum": 1}
        }}
    ]
    
    severity_stats = await db.issues.aggregate(severity_pipeline).to_list(10)
    
    type_pipeline = [
        {"$match": {"company_id": company_id}},
        {"$group": {
            "_id": "$issue_type",
            "count": {"$sum": 1}
        }}
    ]
    
    type_stats = await db.issues.aggregate(type_pipeline).to_list(10)
    
    return {
        "by_status": {s["_id"]: {"count": s["count"], "cost": s.get("total_cost", 0)} for s in status_stats},
        "by_severity": {s["_id"]: s["count"] for s in severity_stats},
        "by_type": {s["_id"]: s["count"] for s in type_stats}
    }
