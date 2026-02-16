"""Authentication routes"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from models import User, LoginRequest, TokenResponse, RefreshRequest
from utils import (
    db, get_current_user, serialize_doc,
    hash_password, verify_password, create_access_token, create_refresh_token, decode_token
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    user = None
    
    # Admin login (email + password)
    if request.email and request.password:
        user = await db.users.find_one({"email": request.email}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        if not user.get("password_hash"):
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        if not verify_password(request.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    # Driver login (DNI + PIN)
    elif request.dni and request.pin:
        user = await db.users.find_one({"dni": request.dni}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        
        # Check lockout
        if user.get("locked_until"):
            locked_until = user["locked_until"]
            if isinstance(locked_until, str):
                locked_until = datetime.fromisoformat(locked_until)
            if datetime.now(timezone.utc) < locked_until:
                raise HTTPException(status_code=403, detail="Cuenta bloqueada temporalmente")
        
        if not user.get("pin_hash"):
            raise HTTPException(status_code=401, detail="PIN no configurado")
        
        if not verify_password(request.pin, user["pin_hash"]):
            # Increment failed attempts
            failed_attempts = user.get("failed_attempts", 0) + 1
            update_data = {"failed_attempts": failed_attempts}
            
            if failed_attempts >= 5:
                update_data["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
            
            await db.users.update_one({"id": user["id"]}, {"$set": update_data})
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        
        # Reset failed attempts on successful login
        await db.users.update_one(
            {"id": user["id"]}, 
            {"$set": {"failed_attempts": 0, "locked_until": None}}
        )
    else:
        raise HTTPException(status_code=400, detail="Se requiere email/password o DNI/PIN")
    
    if not user.get("is_active"):
        raise HTTPException(status_code=403, detail="Usuario desactivado")
    
    # Create tokens
    token_data = {
        "user_id": user["id"],
        "company_id": user["company_id"],
        "role": user["role"]
    }
    
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    # Return user info (without sensitive data)
    user_response = {
        "id": user["id"],
        "company_id": user["company_id"],
        "name": user["name"],
        "email": user.get("email"),
        "dni": user.get("dni"),
        "role": user["role"],
        "force_password_change": user.get("force_password_change", False)
    }
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_response
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshRequest):
    payload = decode_token(request.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token inválido")
    
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user or not user.get("is_active"):
        raise HTTPException(status_code=401, detail="Usuario no válido")
    
    token_data = {
        "user_id": user["id"],
        "company_id": user["company_id"],
        "role": user["role"]
    }
    
    new_access_token = create_access_token(token_data)
    new_refresh_token = create_refresh_token(token_data)
    
    user_response = {
        "id": user["id"],
        "company_id": user["company_id"],
        "name": user["name"],
        "email": user.get("email"),
        "dni": user.get("dni"),
        "role": user["role"]
    }
    
    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        user=user_response
    )


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return serialize_doc(current_user)
