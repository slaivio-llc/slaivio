from fastapi.responses import JSONResponse

from app.core.logger import logger


async def global_exception_handler(
    request,
    exc,
):
    from app.billing.services.capacity import limit_error
    capacity = limit_error(exc)
    if capacity:
        return JSONResponse(status_code=409, content={'detail': capacity})
    logger.exception(
        "unhandled_exception"
    )

    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "internal_server_error",
        },
    )
