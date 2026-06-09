import re

SENDIT_STATUS_LABELS = {
    "CANCELED":        "Annulé",
    "DELIVERED":       "Livré",
    "DELIVERING":      "En cours de livraison",
    "DISTRIBUTED":     "Distribué",
    "NEW_DESTINATION": "À changer",
    "PENDING":         "En attente",
    "PICKEDUP":        "Ramassé",
    "POSTPONED":       "Reporté",
    "REJECTED":        "Refusé",
    "TOPICKUP":        "Ramassage en cours",
    "TO_PREPARE":      "À préparer",
    "TRANSIT":         "En transit",
    "UNREACHABLE":     "Injoignable",
    "WAREHOUSE":       "Entrepôt",
}

SIZE_TOKENS = {
    "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL",
    "2XL", "3XL", "4XL", "5XL",
}


def parse_fee(value):
    if value is None:
        return 0.0
    normalized = re.sub(r'[^0-9.,-]', '', str(value)).replace(',', '.')
    try:
        return float(normalized) if normalized else 0.0
    except ValueError:
        return 0.0


def parse_variant(value):
    raw = (value or "").strip()
    if not raw:
        return "Taille inconnue", "Couleur inconnue"
    parts = [p.strip() for p in re.split(r"[|/,-]", raw) if p.strip()]
    if not parts:
        return "Taille inconnue", "Couleur inconnue"
    size = None
    color = None
    for part in parts:
        if part.upper() in SIZE_TOKENS:
            size = part.upper()
        elif color is None:
            color = part
    return size or "Taille inconnue", color or "Couleur inconnue"


def top_entries(source, n=10):
    items = sorted(source.items(), key=lambda x: x[1], reverse=True)[:n]
    return [{"libelle": k, "quantite": v} for k, v in items]
