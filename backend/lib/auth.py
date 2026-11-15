from typing import Optional
from fastapi import Header, HTTPException, status

def get_device_id(x_device_id: Optional[str] = Header(None, alias="X-Device-Id")) -> Optional[str]:
    return x_device_id

def require_device_id(x_device_id: Optional[str] = Header(None, alias="X-Device-Id")) -> str:
    if not x_device_id or not x_device_id.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Header 'X-Device-Id' is required."
        )
    return x_device_id.strip()
