import requests

from app.core.logger import logger


DEFAULT_TIMEOUT = 20


def meta_get(
    url: str,
    headers: dict | None = None,
    params: dict | None = None,
):
    try:
        response = requests.get(
            url,
            headers=headers,
            params=params,
            timeout=DEFAULT_TIMEOUT,
        )

        return {
            "ok": response.ok,
            "status_code": response.status_code,
            "data": response.json(),
        }

    except requests.Timeout:
        logger.error(
            "meta_timeout"
        )

        return {
            "ok": False,
            "status_code": 504,
            "data": {
                "error": "meta_timeout",
            },
        }

    except Exception as exc:
        logger.exception(
            "meta_http_error"
        )

        return {
            "ok": False,
            "status_code": 500,
            "data": {
                "error": str(exc),
            },
        }


def meta_post(
    url: str,
    headers: dict | None = None,
    json: dict | None = None,
):
    try:
        response = requests.post(
            url,
            headers=headers,
            json=json,
            timeout=DEFAULT_TIMEOUT,
        )

        return {
            "ok": response.ok,
            "status_code": response.status_code,
            "data": response.json(),
        }

    except requests.Timeout:
        logger.error(
            "meta_timeout"
        )

        return {
            "ok": False,
            "status_code": 504,
            "data": {
                "error": "meta_timeout",
            },
        }

    except Exception as exc:
        logger.exception(
            "meta_http_error"
        )

        return {
            "ok": False,
            "status_code": 500,
            "data": {
                "error": str(exc),
            },
        }
