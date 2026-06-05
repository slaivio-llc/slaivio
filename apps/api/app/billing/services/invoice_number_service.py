from datetime import datetime
from uuid import uuid4


def generate_invoice_number():
    return f"SLV-{datetime.utcnow().strftime('%Y%m%d')}-{str(uuid4())[:8].upper()}"

