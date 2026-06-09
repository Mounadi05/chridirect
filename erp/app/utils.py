import re

ORDER_STATUSES = {
    "Confirmé", "En cours",
    "Pas de réponse 1", "Pas de réponse 2", "Pas de réponse 3",
    "whatsapp", "Annulé (avant envoi)", "Double",
    "Livré", "Annulé", "Refusé", "Retourné", "Injoignable",
    # Self-delivery statuses (no Sendit, owner delivers personally)
    "Confirmé direct", "En livraison directe",
    # Sendit-driven labels (set automatically once a delivery exists)
    "En attente", "À préparer", "À changer", "Ramassage en cours",
    "Ramassage à vérifier", "Ramassé", "Entrepôt", "En transit", "Programmé",
    "Reporté", "Distribué","En cours de livraison", "Remboursé",
}

# ── Sendit delivery status ──────────────────────────────────────────────────
# Single source of truth for Sendit status codes. Once a delivery exists, the
# Sendit status overrides Order.order_status (materialized via
# order_routes.apply_sendit_status). Full code set mirrors the sendit.ma filter.
SENDIT_CODE_TO_LABEL = {
    "PENDING":         "En attente",
    "TO_PREPARE":      "À préparer",
    "NEW_DESTINATION": "À changer",
    "TOPICKUP":        "Ramassage en cours",
    "PICKUP_TOCHECK":  "Ramassage à vérifier",
    "PICKEDUP":        "Ramassé",
    "WAREHOUSE":       "Entrepôt",
    "TRANSIT":         "En transit",
    "SCHEDULED":       "Programmé",
    "DISTRIBUTED":     "Distribué",
    "UNREACHABLE":     "Injoignable",
    "POSTPONED":       "Reporté",
    "DELIVERING":      "En cours de livraison",
    "CANCELED":        "Annulé",
    "REJECTED":        "Refusé",
    "DELIVERED":       "Livré",
    "REFUNDED":        "Remboursé",
}
# Codes that mark the order finished (is_completed = True).
SENDIT_TERMINAL_CODES = {"DELIVERED", "CANCELED", "REJECTED", "REFUNDED"}
# Reverse map — French label → code, for filtering the Sendit column.
SENDIT_LABEL_TO_CODE = {label: code for code, label in SENDIT_CODE_TO_LABEL.items()}

# Statuses that mark an order as finished (is_completed = True). Any status NOT
# in this set is "open" — moving an order back to one of those must clear the
# completed flag so it re-enters the normal workflow.
TERMINAL_ORDER_STATUSES = {
    "Livré", "Annulé", "Refusé", "Retourné", "Annulé (avant envoi)",
}

def map_internal_status(value):
    raw = (value or "").strip().lower()
    if raw in {"confirmed", "confirmé", "confirme"}:
        return "Confirmé"
    if raw in {"en cours", "encours"}:
        return "En cours"
    if raw.startswith("annul"):
        return "Annulé (avant envoi)"
    return value if value in ORDER_STATUSES else None

def normalize_variant(v_input):
    if not v_input:
        return "no variant"
        
    if isinstance(v_input, dict):
        v_input = list(v_input.values())
        
    if isinstance(v_input, list):
        v_string = " ".join([str(v) for v in v_input])
    else:
        v_string = str(v_input)

    v_string = v_string.lower()
   
    v_string = re.sub(r'[^\w\s]', ' ', v_string, flags=re.UNICODE)
    v_string = v_string.replace('_', ' ')
    
   
    words = sorted([w.strip() for w in v_string.split() if w.strip()])
    
    return " ".join(words) if words else "no variant"

def fuzzy_match_product(yc_name, db_name):
    if not yc_name or not db_name:
        return False
        
    yc_lower = yc_name.lower().strip()
    db_lower = db_name.lower().strip()
    
    if db_lower in yc_lower or yc_lower in db_lower:
        return True
        
    yc_words = set(re.sub(r'[^\w\s]', ' ', yc_lower, flags=re.UNICODE).split())
    db_words = set(re.sub(r'[^\w\s]', ' ', db_lower, flags=re.UNICODE).split())
    
    if yc_words and db_words:
        if yc_words.issubset(db_words) or db_words.issubset(yc_words):
            return True
            
    return False