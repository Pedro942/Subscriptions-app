from __future__ import annotations

import csv
import io
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Literal

import firebase_admin
import httpx
from bson import ObjectId
from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from passlib.context import CryptContext
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    mongo_uri: str = "mongodb://localhost:27017"
    mongo_database: str = "subscription_hub"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60 * 24 * 7
    firebase_credentials_path: str | None = None
    fx_rates_url: str = "https://api.exchangerate.host/latest?base=EUR"
    fx_refresh_hours: int = 12


settings = Settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD", "AUD", "JPY"]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    device_id: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class FirebaseLoginRequest(BaseModel):
    id_token: str
    device_id: str | None = None


class MigrateRequest(BaseModel):
    device_id: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: EmailStr


class PlatformOut(BaseModel):
    id: str
    slug: str
    name: str
    category: str


class SharedMember(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    share_ratio: float = Field(gt=0, le=1)


class SubscriptionCreate(BaseModel):
    platform_id: str | None = None
    custom_name: str | None = None
    custom_category: str | None = None
    renewal_date: date
    amount: float = Field(gt=0)
    billing_cycle: Literal["monthly", "yearly"] = "monthly"
    currency: str = "EUR"
    trial_end_date: date | None = None
    is_trial: bool = False
    shared_with: list[SharedMember] = Field(default_factory=list)


class SubscriptionUpdate(BaseModel):
    renewal_date: date | None = None
    amount: float | None = Field(default=None, gt=0)
    billing_cycle: Literal["monthly", "yearly"] | None = None
    currency: str | None = None
    trial_end_date: date | None = None
    is_trial: bool | None = None
    shared_with: list[SharedMember] | None = None


class SharedMemberOut(BaseModel):
    name: str
    share_ratio: float


class PriceHistoryEntry(BaseModel):
    changed_at: str
    old_amount: float
    new_amount: float
    old_currency: str
    new_currency: str


class SubscriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    category: str
    renewal_date: date
    amount: float
    billing_cycle: Literal["monthly", "yearly"]
    currency: str
    platform_slug: str | None = None
    trial_end_date: date | None = None
    is_trial: bool = False
    shared_with: list[SharedMemberOut] = Field(default_factory=list)
    effective_personal_share: float = 1.0
    duplicate_count: int = 0
    price_history: list[PriceHistoryEntry] = Field(default_factory=list)


class BudgetConfig(BaseModel):
    monthly_limit: float = Field(gt=0)
    category_limits: dict[str, float] = Field(default_factory=dict)


class BudgetResponse(BaseModel):
    monthly_limit: float
    category_limits: dict[str, float]
    monthly_total: float
    monthly_usage_percent: float
    over_budget: bool
    over_budget_amount: float
    category_usage: dict[str, dict[str, float | bool]]


class InsightOut(BaseModel):
    title: str
    value: str
    severity: Literal["info", "warning", "danger"]


class AnalyticsResponse(BaseModel):
    monthly_total: float
    yearly_total: float
    category_breakdown: dict[str, dict[str, float]]
    upcoming_renewals: list[dict[str, str | float]]
    currency: str
    subscriptions_count: int
    average_monthly_per_subscription: float
    top_category: dict[str, str | float] | None = None
    upcoming_renewals_count: int
    next_renewal_date: str | None = None
    trial_conversions: list[dict[str, str]]
    duplicate_groups: list[dict[str, str | int]]
    insights: list[InsightOut]
    budget_status: BudgetResponse | None = None
    savings_target_10_percent: float


class OwnerContext(BaseModel):
    owner_type: Literal["device", "user"]
    owner_id: str
    user: dict | None = None


class ExportPayload(BaseModel):
    subscriptions: list[dict]


class CsvImportPayload(BaseModel):
    csv_data: str


class FxRatesResponse(BaseModel):
    base: str
    rates: dict[str, float]
    fetched_at: str | None
    source: str


POPULAR_PLATFORMS = [
    {"slug": "netflix", "name": "Netflix", "category": "Video Streaming"},
    {"slug": "amazon-prime-video", "name": "Amazon Prime Video", "category": "Video Streaming"},
    {"slug": "disney-plus", "name": "Disney+", "category": "Video Streaming"},
    {"slug": "hbo-max", "name": "HBO Max", "category": "Video Streaming"},
    {"slug": "hulu", "name": "Hulu", "category": "Video Streaming"},
    {"slug": "apple-tv-plus", "name": "Apple TV+", "category": "Video Streaming"},
    {"slug": "youtube-premium", "name": "YouTube Premium", "category": "Video Streaming"},
    {"slug": "spotify", "name": "Spotify", "category": "Music"},
    {"slug": "apple-music", "name": "Apple Music", "category": "Music"},
    {"slug": "deezer", "name": "Deezer", "category": "Music"},
    {"slug": "tidal", "name": "TIDAL", "category": "Music"},
    {"slug": "xbox-game-pass", "name": "Xbox Game Pass", "category": "Gaming"},
    {"slug": "playstation-plus", "name": "PlayStation Plus", "category": "Gaming"},
    {"slug": "nintendo-switch-online", "name": "Nintendo Switch Online", "category": "Gaming"},
    {"slug": "ea-play", "name": "EA Play", "category": "Gaming"},
    {"slug": "ubisoft-plus", "name": "Ubisoft+", "category": "Gaming"},
    {"slug": "nvidia-geforce-now", "name": "NVIDIA GeForce NOW", "category": "Gaming"},
    {"slug": "google-one", "name": "Google One", "category": "Cloud Storage"},
    {"slug": "icloud-plus", "name": "iCloud+", "category": "Cloud Storage"},
    {"slug": "dropbox", "name": "Dropbox", "category": "Cloud Storage"},
    {"slug": "onedrive", "name": "Microsoft OneDrive", "category": "Cloud Storage"},
    {"slug": "adobe-creative-cloud", "name": "Adobe Creative Cloud", "category": "Productivity"},
    {"slug": "microsoft-365", "name": "Microsoft 365", "category": "Productivity"},
    {"slug": "notion-plus", "name": "Notion Plus", "category": "Productivity"},
    {"slug": "evernote", "name": "Evernote", "category": "Productivity"},
    {"slug": "canva-pro", "name": "Canva Pro", "category": "Productivity"},
    {"slug": "duolingo-plus", "name": "Duolingo Super", "category": "Education"},
    {"slug": "coursera-plus", "name": "Coursera Plus", "category": "Education"},
    {"slug": "masterclass", "name": "MasterClass", "category": "Education"},
    {"slug": "new-york-times", "name": "The New York Times", "category": "News"},
    {"slug": "medium-member", "name": "Medium Member", "category": "News"},
    {"slug": "headspace", "name": "Headspace", "category": "Wellness"},
    {"slug": "calm", "name": "Calm", "category": "Wellness"},
    {"slug": "strava", "name": "Strava", "category": "Fitness"},
    {"slug": "nike-run-club", "name": "Nike Run Club", "category": "Fitness"},
    {"slug": "amazon-prime", "name": "Amazon Prime", "category": "Shopping"},
    {"slug": "walmart-plus", "name": "Walmart+", "category": "Shopping"},
]


# Amount of EUR equal to one unit of currency.
FALLBACK_CURRENCY_RATES_TO_EUR = {
    "EUR": 1.0,
    "USD": 0.92,
    "GBP": 1.16,
    "CHF": 1.03,
    "CAD": 0.68,
    "AUD": 0.61,
    "JPY": 0.0061,
}


app = FastAPI(title="Subscription Hub API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_database() -> AsyncIOMotorDatabase:
    return app.state.db


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str, email: str) -> str:
    expires = datetime.now(UTC) + timedelta(minutes=settings.access_token_minutes)
    payload = {"sub": user_id, "email": email, "exp": expires}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def parse_object_id(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid object id.")
    return ObjectId(value)


def normalize_currency(currency: str | None) -> str:
    if not currency:
        return "EUR"
    upper = currency.upper()
    return upper if upper in SUPPORTED_CURRENCIES else "EUR"


def get_rate_map() -> dict[str, float]:
    return app.state.fx_rates_to_eur


def convert_currency(amount: float, src: str, target: str) -> float:
    rates = get_rate_map()
    src_rate = rates.get(normalize_currency(src), 1.0)
    target_rate = rates.get(normalize_currency(target), 1.0)
    amount_in_eur = amount * src_rate
    return amount_in_eur / target_rate


def monthly_cost(amount: float, billing_cycle: str) -> float:
    return amount if billing_cycle == "monthly" else amount / 12


def normalize_shared_members(shared_with: list[dict] | None) -> list[dict]:
    members = shared_with or []
    if not members:
        return []
    total_ratio = sum(float(member.get("share_ratio", 0)) for member in members)
    if total_ratio > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Total share_ratio for shared_with cannot exceed 1.",
        )
    return [
        {"name": str(member["name"]).strip(), "share_ratio": float(member["share_ratio"])}
        for member in members
        if str(member.get("name", "")).strip()
    ]


def compute_duplicate_count(doc: dict, duplicates: dict[tuple[str, str], int]) -> int:
    key = (doc.get("name", "").strip().lower(), doc.get("category", "").strip().lower())
    return duplicates.get(key, 1)


def serialize_subscription(document: dict, duplicates: dict[tuple[str, str], int] | None = None) -> SubscriptionOut:
    duplicate_map = duplicates or {}
    shared_members = document.get("shared_with", []) or []
    own_share = max(0.0, 1.0 - sum(float(member.get("share_ratio", 0)) for member in shared_members))
    history = document.get("price_history", []) or []
    return SubscriptionOut(
        id=str(document["_id"]),
        name=document["name"],
        category=document["category"],
        renewal_date=document["renewal_date"],
        amount=document["amount"],
        billing_cycle=document["billing_cycle"],
        currency=document["currency"],
        platform_slug=document.get("platform_slug"),
        trial_end_date=document.get("trial_end_date"),
        is_trial=bool(document.get("is_trial", False)),
        shared_with=[SharedMemberOut(**member) for member in shared_members],
        effective_personal_share=round(own_share, 4),
        duplicate_count=compute_duplicate_count(document, duplicate_map),
        price_history=[
            PriceHistoryEntry(
                changed_at=item["changed_at"],
                old_amount=float(item["old_amount"]),
                new_amount=float(item["new_amount"]),
                old_currency=item["old_currency"],
                new_currency=item["new_currency"],
            )
            for item in history
        ],
    )


async def resolve_user_from_token(token: str, db: AsyncIOMotorDatabase) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.")
        user = await db.users.find_one({"_id": parse_object_id(user_id)})
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
        return user
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.") from exc


async def get_owner_context(
    request: Request,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    token: Annotated[str | None, Depends(oauth2_optional)],
) -> OwnerContext:
    if token:
        user = await resolve_user_from_token(token, db)
        return OwnerContext(owner_type="user", owner_id=str(user["_id"]), user=user)

    device_id = request.headers.get("x-device-id") or request.query_params.get("device_id")
    if not device_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="x-device-id header is required when not authenticated.",
        )
    return OwnerContext(owner_type="device", owner_id=device_id, user=None)


async def get_authenticated_user(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    token: Annotated[str | None, Depends(oauth2_optional)],
) -> dict:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    return await resolve_user_from_token(token, db)


async def migrate_device_subscriptions(db: AsyncIOMotorDatabase, device_id: str, user_id: str) -> int:
    result = await db.subscriptions.update_many(
        {"owner_type": "device", "owner_id": device_id},
        {"$set": {"owner_type": "user", "owner_id": user_id, "updated_at": datetime.now(UTC)}},
    )
    return result.modified_count


async def seed_platform_catalog(db: AsyncIOMotorDatabase) -> None:
    existing_count = await db.platforms.count_documents({})
    if existing_count:
        return
    await db.platforms.insert_many(POPULAR_PLATFORMS)


def ensure_firebase_initialized() -> None:
    if firebase_admin._apps:
        return
    if not settings.firebase_credentials_path:
        return
    cred = credentials.Certificate(settings.firebase_credentials_path)
    firebase_admin.initialize_app(cred)


async def refresh_fx_rates(force: bool = False) -> None:
    now = datetime.now(UTC)
    last_fetch: datetime | None = app.state.fx_last_fetch
    if not force and last_fetch and now - last_fetch < timedelta(hours=settings.fx_refresh_hours):
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(settings.fx_rates_url)
            response.raise_for_status()
            payload = response.json()
        rates_from_eur = payload.get("rates", {})
        normalized: dict[str, float] = {"EUR": 1.0}
        for currency in SUPPORTED_CURRENCIES:
            if currency == "EUR":
                continue
            value = rates_from_eur.get(currency)
            if isinstance(value, (int, float)) and value > 0:
                # API gives 1 EUR = value currency. We store inverse: 1 currency = x EUR.
                normalized[currency] = 1 / float(value)
        if len(normalized) >= 3:
            app.state.fx_rates_to_eur = {**FALLBACK_CURRENCY_RATES_TO_EUR, **normalized}
            app.state.fx_last_fetch = now
            app.state.fx_source = "live"
            return
    except Exception:  # noqa: BLE001
        pass
    app.state.fx_source = "fallback"
    if not app.state.fx_last_fetch:
        app.state.fx_last_fetch = now


def build_duplicate_map(items: list[dict]) -> dict[tuple[str, str], int]:
    duplicates: dict[tuple[str, str], int] = {}
    for item in items:
        key = (item.get("name", "").strip().lower(), item.get("category", "").strip().lower())
        duplicates[key] = duplicates.get(key, 0) + 1
    return duplicates


async def get_budget_for_owner(db: AsyncIOMotorDatabase, owner: OwnerContext) -> dict | None:
    return await db.budgets.find_one({"owner_type": owner.owner_type, "owner_id": owner.owner_id})


def compute_budget_status(
    items: list[dict],
    category_breakdown: dict[str, dict[str, float]],
    target_currency: str,
    budget_doc: dict | None,
) -> BudgetResponse | None:
    if not budget_doc:
        return None
    monthly_limit = float(budget_doc.get("monthly_limit", 0))
    category_limits = {k: float(v) for k, v in (budget_doc.get("category_limits") or {}).items() if float(v) > 0}
    if monthly_limit <= 0:
        return None
    monthly_total = 0.0
    for item in items:
        converted_amount = convert_currency(item["amount"], item["currency"], target_currency)
        monthly_total += monthly_cost(converted_amount, item["billing_cycle"])
    monthly_usage_percent = (monthly_total / monthly_limit) * 100 if monthly_limit else 0
    over_budget_amount = max(0.0, monthly_total - monthly_limit)
    category_usage: dict[str, dict[str, float | bool]] = {}
    for category, totals in category_breakdown.items():
        limit = category_limits.get(category, 0.0)
        usage = totals["monthly"]
        category_usage[category] = {
            "monthly_total": round(usage, 2),
            "limit": round(limit, 2),
            "usage_percent": round((usage / limit) * 100, 2) if limit > 0 else 0.0,
            "over_limit": bool(limit > 0 and usage > limit),
        }
    return BudgetResponse(
        monthly_limit=round(monthly_limit, 2),
        category_limits={k: round(v, 2) for k, v in category_limits.items()},
        monthly_total=round(monthly_total, 2),
        monthly_usage_percent=round(monthly_usage_percent, 2),
        over_budget=monthly_total > monthly_limit,
        over_budget_amount=round(over_budget_amount, 2),
        category_usage=category_usage,
    )


def build_insights(
    monthly_total: float,
    yearly_total: float,
    top_category: dict[str, str | float] | None,
    upcoming_renewals_count: int,
    trial_conversions: list[dict[str, str]],
    duplicate_groups: list[dict[str, str | int]],
    budget_status: BudgetResponse | None,
    currency: str,
) -> list[InsightOut]:
    insights: list[InsightOut] = []
    insights.append(
        InsightOut(
            title="Current burn rate",
            value=f"{monthly_total:.2f} {currency}/month • {yearly_total:.2f} {currency}/year",
            severity="info",
        )
    )
    if top_category:
        insights.append(
            InsightOut(
                title="Top spending category",
                value=f"{top_category['name']} at {top_category['monthly']:.2f} {currency}/month",
                severity="info",
            )
        )
    if upcoming_renewals_count >= 3:
        insights.append(
            InsightOut(
                title="High renewal activity",
                value=f"{upcoming_renewals_count} renewals due within 30 days",
                severity="warning",
            )
        )
    if trial_conversions:
        insights.append(
            InsightOut(
                title="Trials ending soon",
                value=f"{len(trial_conversions)} trial(s) converting in next 14 days",
                severity="warning",
            )
        )
    if duplicate_groups:
        insights.append(
            InsightOut(
                title="Potential duplicate subscriptions",
                value=f"{len(duplicate_groups)} duplicated group(s) detected",
                severity="danger",
            )
        )
    if budget_status and budget_status.over_budget:
        insights.append(
            InsightOut(
                title="Budget exceeded",
                value=f"Over budget by {budget_status.over_budget_amount:.2f} {currency}",
                severity="danger",
            )
        )
    return insights


@app.on_event("startup")
async def startup_event() -> None:
    client = AsyncIOMotorClient(settings.mongo_uri)
    app.state.mongo_client = client
    app.state.db = client[settings.mongo_database]
    app.state.fx_rates_to_eur = FALLBACK_CURRENCY_RATES_TO_EUR.copy()
    app.state.fx_last_fetch = None
    app.state.fx_source = "fallback"

    await app.state.db.users.create_index("email", unique=True)
    await app.state.db.subscriptions.create_index([("owner_type", 1), ("owner_id", 1)])
    await app.state.db.subscriptions.create_index("renewal_date")
    await app.state.db.platforms.create_index("slug", unique=True)
    await app.state.db.budgets.create_index([("owner_type", 1), ("owner_id", 1)], unique=True)
    await seed_platform_catalog(app.state.db)
    ensure_firebase_initialized()
    await refresh_fx_rates(force=True)


@app.on_event("shutdown")
async def shutdown_event() -> None:
    app.state.mongo_client.close()


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/fx-rates", response_model=FxRatesResponse)
async def get_fx_rates(force_refresh: bool = False) -> FxRatesResponse:
    await refresh_fx_rates(force=force_refresh)
    # return user-facing map in EUR base (1 EUR -> X currency)
    to_currency = {
        currency: round(1 / value, 6) if value else 0
        for currency, value in app.state.fx_rates_to_eur.items()
        if currency in SUPPORTED_CURRENCIES
    }
    return FxRatesResponse(
        base="EUR",
        rates=to_currency,
        fetched_at=app.state.fx_last_fetch.isoformat() if app.state.fx_last_fetch else None,
        source=app.state.fx_source,
    )


@app.post("/auth/register", response_model=TokenResponse)
async def register(
    payload: RegisterRequest,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
) -> TokenResponse:
    existing_user = await db.users.find_one({"email": payload.email.lower()})
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered.")

    user_doc = {
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    if payload.device_id:
        await migrate_device_subscriptions(db, payload.device_id, user_id)

    token = create_access_token(user_id=user_id, email=payload.email.lower())
    return TokenResponse(access_token=token, user_id=user_id, email=payload.email.lower())


@app.post("/auth/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
) -> TokenResponse:
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")

    user_id = str(user["_id"])
    token = create_access_token(user_id=user_id, email=user["email"])
    return TokenResponse(access_token=token, user_id=user_id, email=user["email"])


@app.post("/auth/firebase-login", response_model=TokenResponse)
async def firebase_login(
    payload: FirebaseLoginRequest,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
) -> TokenResponse:
    if not firebase_admin._apps:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Firebase auth is not configured on the server.",
        )

    try:
        decoded_token = firebase_auth.verify_id_token(payload.id_token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase token.") from exc

    email = decoded_token.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Firebase token missing email.")

    user = await db.users.find_one({"email": email.lower()})
    if not user:
        user_doc = {
            "email": email.lower(),
            "password_hash": None,
            "firebase_uid": decoded_token.get("uid"),
            "created_at": datetime.now(UTC),
            "updated_at": datetime.now(UTC),
        }
        result = await db.users.insert_one(user_doc)
        user = {**user_doc, "_id": result.inserted_id}

    user_id = str(user["_id"])
    if payload.device_id:
        await migrate_device_subscriptions(db, payload.device_id, user_id)

    token = create_access_token(user_id=user_id, email=email.lower())
    return TokenResponse(access_token=token, user_id=user_id, email=email.lower())


@app.post("/auth/migrate")
async def migrate_anonymous_subscriptions(
    payload: MigrateRequest,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    user: Annotated[dict, Depends(get_authenticated_user)],
) -> dict[str, int]:
    moved = await migrate_device_subscriptions(db, payload.device_id, str(user["_id"]))
    return {"migrated_subscriptions": moved}


@app.get("/platforms", response_model=list[PlatformOut])
async def list_platforms(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    category: str | None = None,
) -> list[PlatformOut]:
    query = {"category": category} if category else {}
    cursor = db.platforms.find(query).sort("name", 1)
    platforms: list[PlatformOut] = []
    async for platform in cursor:
        platforms.append(
            PlatformOut(
                id=str(platform["_id"]),
                slug=platform["slug"],
                name=platform["name"],
                category=platform["category"],
            )
        )
    return platforms


@app.get("/subscriptions", response_model=list[SubscriptionOut])
async def get_subscriptions(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    owner: Annotated[OwnerContext, Depends(get_owner_context)],
    q: str | None = None,
    category: str | None = None,
    sort_by: Literal["renewal_date", "amount", "name"] = "renewal_date",
    sort_order: Literal["asc", "desc"] = "asc",
) -> list[SubscriptionOut]:
    query: dict = {"owner_type": owner.owner_type, "owner_id": owner.owner_id}
    if category:
        query["category"] = category
    if q:
        query["name"] = {"$regex": q, "$options": "i"}

    sort_field = sort_by
    direction = 1 if sort_order == "asc" else -1
    cursor = db.subscriptions.find(query).sort(sort_field, direction)
    items: list[dict] = []
    async for item in cursor:
        items.append(item)
    duplicates = build_duplicate_map(items)
    return [serialize_subscription(item, duplicates) for item in items]


@app.post("/subscriptions/duplicate-check")
async def duplicate_check(
    payload: SubscriptionCreate,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    owner: Annotated[OwnerContext, Depends(get_owner_context)],
) -> dict[str, str | bool | int]:
    name = payload.custom_name
    category = payload.custom_category or "Other"
    if payload.platform_id:
        platform_doc = await db.platforms.find_one({"_id": parse_object_id(payload.platform_id)})
        if platform_doc:
            name = platform_doc["name"]
            category = platform_doc["category"]
    if not name:
        return {"is_duplicate": False, "message": "No name to compare."}

    count = await db.subscriptions.count_documents(
        {
            "owner_type": owner.owner_type,
            "owner_id": owner.owner_id,
            "name": {"$regex": f"^{name}$", "$options": "i"},
            "category": {"$regex": f"^{category}$", "$options": "i"},
        }
    )
    return {
        "is_duplicate": count > 0,
        "duplicate_count": count,
        "message": "Potential duplicate found." if count > 0 else "No duplicates found.",
    }


@app.post("/subscriptions", response_model=SubscriptionOut, status_code=status.HTTP_201_CREATED)
async def create_subscription(
    payload: SubscriptionCreate,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    owner: Annotated[OwnerContext, Depends(get_owner_context)],
) -> SubscriptionOut:
    if owner.owner_type == "device":
        anon_count = await db.subscriptions.count_documents({"owner_type": "device", "owner_id": owner.owner_id})
        if anon_count >= 10:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Authentication required after 10 subscriptions.",
            )

    name = payload.custom_name
    category = payload.custom_category or "Other"
    platform_slug = None

    if payload.platform_id:
        platform_doc = await db.platforms.find_one({"_id": parse_object_id(payload.platform_id)})
        if not platform_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform not found.")
        name = platform_doc["name"]
        category = platform_doc["category"]
        platform_slug = platform_doc["slug"]

    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either platform_id or custom_name.",
        )

    shared_members = normalize_shared_members([member.model_dump() for member in payload.shared_with])
    document = {
        "owner_type": owner.owner_type,
        "owner_id": owner.owner_id,
        "platform_slug": platform_slug,
        "name": name,
        "category": category,
        "renewal_date": payload.renewal_date,
        "amount": payload.amount,
        "billing_cycle": payload.billing_cycle,
        "currency": normalize_currency(payload.currency),
        "trial_end_date": payload.trial_end_date,
        "is_trial": payload.is_trial,
        "shared_with": shared_members,
        "price_history": [],
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }
    result = await db.subscriptions.insert_one(document)
    saved = await db.subscriptions.find_one({"_id": result.inserted_id})
    duplicates = build_duplicate_map([saved] if saved else [])
    return serialize_subscription(saved, duplicates)


@app.put("/subscriptions/{subscription_id}", response_model=SubscriptionOut)
async def update_subscription(
    subscription_id: str,
    payload: SubscriptionUpdate,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    owner: Annotated[OwnerContext, Depends(get_owner_context)],
) -> SubscriptionOut:
    query = {
        "_id": parse_object_id(subscription_id),
        "owner_type": owner.owner_type,
        "owner_id": owner.owner_id,
    }
    existing = await db.subscriptions.find_one(query)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found.")

    updates = payload.model_dump(exclude_unset=True)
    if "currency" in updates:
        updates["currency"] = normalize_currency(updates["currency"])
    if "shared_with" in updates and updates["shared_with"] is not None:
        updates["shared_with"] = normalize_shared_members(updates["shared_with"])

    # Keep a concise history for price changes.
    amount_changed = "amount" in updates and updates["amount"] != existing["amount"]
    currency_changed = "currency" in updates and updates["currency"] != existing["currency"]
    if amount_changed or currency_changed:
        history_entry = {
            "changed_at": datetime.now(UTC).isoformat(),
            "old_amount": existing["amount"],
            "new_amount": updates.get("amount", existing["amount"]),
            "old_currency": existing["currency"],
            "new_currency": updates.get("currency", existing["currency"]),
        }
        current_history = list(existing.get("price_history", []))
        current_history.append(history_entry)
        updates["price_history"] = current_history[-30:]

    if updates:
        updates["updated_at"] = datetime.now(UTC)
        await db.subscriptions.update_one(query, {"$set": updates})
    updated = await db.subscriptions.find_one(query)
    duplicates = build_duplicate_map([updated] if updated else [])
    return serialize_subscription(updated, duplicates)


@app.delete("/subscriptions/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subscription(
    subscription_id: str,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    owner: Annotated[OwnerContext, Depends(get_owner_context)],
) -> None:
    query = {
        "_id": parse_object_id(subscription_id),
        "owner_type": owner.owner_type,
        "owner_id": owner.owner_id,
    }
    result = await db.subscriptions.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found.")


@app.put("/budgets", response_model=BudgetConfig)
async def set_budgets(
    payload: BudgetConfig,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    owner: Annotated[OwnerContext, Depends(get_owner_context)],
) -> BudgetConfig:
    category_limits = {k: float(v) for k, v in payload.category_limits.items() if float(v) > 0}
    await db.budgets.update_one(
        {"owner_type": owner.owner_type, "owner_id": owner.owner_id},
        {
            "$set": {
                "owner_type": owner.owner_type,
                "owner_id": owner.owner_id,
                "monthly_limit": float(payload.monthly_limit),
                "category_limits": category_limits,
                "updated_at": datetime.now(UTC),
            },
            "$setOnInsert": {"created_at": datetime.now(UTC)},
        },
        upsert=True,
    )
    return BudgetConfig(monthly_limit=float(payload.monthly_limit), category_limits=category_limits)


@app.get("/budgets", response_model=BudgetResponse | None)
async def get_budgets(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    owner: Annotated[OwnerContext, Depends(get_owner_context)],
    currency: str = "EUR",
) -> BudgetResponse | None:
    target_currency = normalize_currency(currency)
    query = {"owner_type": owner.owner_type, "owner_id": owner.owner_id}
    cursor = db.subscriptions.find(query)
    items: list[dict] = []
    async for item in cursor:
        items.append(item)

    category_breakdown: dict[str, dict[str, float]] = {}
    for item in items:
        converted_amount = convert_currency(item["amount"], item["currency"], target_currency)
        monthly_value = monthly_cost(converted_amount, item["billing_cycle"])
        category = item.get("category", "Other")
        bucket = category_breakdown.setdefault(category, {"monthly": 0.0, "yearly": 0.0})
        bucket["monthly"] += monthly_value
        bucket["yearly"] += monthly_value * 12

    budget_doc = await get_budget_for_owner(db, owner)
    if not budget_doc:
        return None
    return compute_budget_status(items, category_breakdown, target_currency, budget_doc)


@app.get("/calendar")
async def calendar_events(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    owner: Annotated[OwnerContext, Depends(get_owner_context)],
    horizon_days: int = 90,
) -> dict[str, list[dict[str, str | float]]]:
    today = date.today()
    horizon = today + timedelta(days=max(1, min(horizon_days, 365)))
    cursor = db.subscriptions.find({"owner_type": owner.owner_type, "owner_id": owner.owner_id})
    events: list[dict[str, str | float]] = []
    async for item in cursor:
        renewal = item.get("renewal_date")
        if isinstance(renewal, date) and today <= renewal <= horizon:
            events.append(
                {
                    "id": str(item["_id"]),
                    "name": item["name"],
                    "category": item.get("category", "Other"),
                    "date": renewal.isoformat(),
                    "amount": float(item["amount"]),
                    "currency": item["currency"],
                    "type": "renewal",
                }
            )
        trial_end = item.get("trial_end_date")
        if isinstance(trial_end, date) and today <= trial_end <= horizon:
            events.append(
                {
                    "id": str(item["_id"]),
                    "name": item["name"],
                    "category": item.get("category", "Other"),
                    "date": trial_end.isoformat(),
                    "amount": float(item["amount"]),
                    "currency": item["currency"],
                    "type": "trial_end",
                }
            )
    events.sort(key=lambda value: value["date"])
    return {"events": events}


@app.get("/export/json")
async def export_json(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    owner: Annotated[OwnerContext, Depends(get_owner_context)],
) -> dict:
    cursor = db.subscriptions.find({"owner_type": owner.owner_type, "owner_id": owner.owner_id})
    subscriptions: list[dict] = []
    async for item in cursor:
        subscriptions.append(
            {
                "name": item["name"],
                "category": item.get("category", "Other"),
                "renewal_date": item["renewal_date"].isoformat(),
                "amount": float(item["amount"]),
                "billing_cycle": item["billing_cycle"],
                "currency": item["currency"],
                "is_trial": bool(item.get("is_trial", False)),
                "trial_end_date": item["trial_end_date"].isoformat() if item.get("trial_end_date") else None,
                "shared_with": item.get("shared_with", []),
            }
        )
    return {"exported_at": datetime.now(UTC).isoformat(), "subscriptions": subscriptions}


@app.get("/export/csv")
async def export_csv(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    owner: Annotated[OwnerContext, Depends(get_owner_context)],
) -> StreamingResponse:
    cursor = db.subscriptions.find({"owner_type": owner.owner_type, "owner_id": owner.owner_id})
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "name",
            "category",
            "renewal_date",
            "amount",
            "billing_cycle",
            "currency",
            "is_trial",
            "trial_end_date",
            "shared_with",
        ]
    )
    async for item in cursor:
        writer.writerow(
            [
                item["name"],
                item.get("category", "Other"),
                item["renewal_date"].isoformat(),
                item["amount"],
                item["billing_cycle"],
                item["currency"],
                "true" if item.get("is_trial") else "false",
                item["trial_end_date"].isoformat() if item.get("trial_end_date") else "",
                ",".join(
                    f"{member['name']}:{member['share_ratio']}" for member in (item.get("shared_with") or [])
                ),
            ]
        )
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=subscriptions.csv"},
    )


@app.post("/import/json")
async def import_json(
    payload: ExportPayload,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    owner: Annotated[OwnerContext, Depends(get_owner_context)],
) -> dict[str, int]:
    inserted = 0
    for item in payload.subscriptions:
        try:
            renewal = date.fromisoformat(item["renewal_date"])
            trial_end_value = item.get("trial_end_date")
            trial_end = date.fromisoformat(trial_end_value) if trial_end_value else None
        except Exception:  # noqa: BLE001
            continue
        shared_members = normalize_shared_members(item.get("shared_with", []))
        await db.subscriptions.insert_one(
            {
                "owner_type": owner.owner_type,
                "owner_id": owner.owner_id,
                "platform_slug": None,
                "name": str(item.get("name", "Imported Subscription")).strip() or "Imported Subscription",
                "category": str(item.get("category", "Other")),
                "renewal_date": renewal,
                "amount": float(item.get("amount", 0) or 0),
                "billing_cycle": item.get("billing_cycle", "monthly"),
                "currency": normalize_currency(item.get("currency")),
                "trial_end_date": trial_end,
                "is_trial": bool(item.get("is_trial", False)),
                "shared_with": shared_members,
                "price_history": [],
                "created_at": datetime.now(UTC),
                "updated_at": datetime.now(UTC),
            }
        )
        inserted += 1
    return {"imported": inserted}


@app.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    owner: Annotated[OwnerContext, Depends(get_owner_context)],
    currency: str = "EUR",
) -> AnalyticsResponse:
    await refresh_fx_rates(force=False)
    target_currency = normalize_currency(currency)
    cursor = db.subscriptions.find({"owner_type": owner.owner_type, "owner_id": owner.owner_id})
    items: list[dict] = []
    async for item in cursor:
        items.append(item)

    duplicates = build_duplicate_map(items)
    monthly_total = 0.0
    yearly_total = 0.0
    category_breakdown: dict[str, dict[str, float]] = {}
    upcoming_renewals: list[dict[str, str | float]] = []
    trial_conversions: list[dict[str, str]] = []
    upcoming_limit_date = date.today() + timedelta(days=30)
    trial_limit_date = date.today() + timedelta(days=14)

    for item in items:
        converted_amount = convert_currency(item["amount"], item["currency"], target_currency)
        own_share = max(
            0.0, 1.0 - sum(float(member.get("share_ratio", 0)) for member in (item.get("shared_with") or []))
        )
        personal_monthly_cost = monthly_cost(converted_amount, item["billing_cycle"]) * own_share
        personal_yearly_cost = personal_monthly_cost * 12
        monthly_total += personal_monthly_cost
        yearly_total += personal_yearly_cost

        category = item.get("category", "Other")
        bucket = category_breakdown.setdefault(category, {"monthly": 0.0, "yearly": 0.0})
        bucket["monthly"] += personal_monthly_cost
        bucket["yearly"] += personal_yearly_cost

        renewal = item["renewal_date"]
        if date.today() <= renewal <= upcoming_limit_date:
            upcoming_renewals.append(
                {
                    "id": str(item["_id"]),
                    "name": item["name"],
                    "renewal_date": renewal.isoformat(),
                    "amount": round(personal_monthly_cost if item["billing_cycle"] == "monthly" else converted_amount, 2),
                    "currency": target_currency,
                }
            )

        trial_end = item.get("trial_end_date")
        if trial_end and date.today() <= trial_end <= trial_limit_date:
            trial_conversions.append(
                {
                    "id": str(item["_id"]),
                    "name": item["name"],
                    "trial_end_date": trial_end.isoformat(),
                }
            )

    rounded_categories = {
        key: {"monthly": round(values["monthly"], 2), "yearly": round(values["yearly"], 2)}
        for key, values in category_breakdown.items()
    }
    upcoming_renewals.sort(key=lambda value: value["renewal_date"])
    trial_conversions.sort(key=lambda value: value["trial_end_date"])

    average_monthly = monthly_total / len(items) if items else 0.0
    top_category_name = None
    top_category_monthly = 0.0
    if rounded_categories:
        top_category_name, totals = max(
            rounded_categories.items(), key=lambda entry: entry[1]["monthly"]
        )
        top_category_monthly = totals["monthly"]

    future_renewals = sorted(
        renewal.isoformat()
        for renewal in (item["renewal_date"] for item in items)
        if isinstance(renewal, date) and renewal >= date.today()
    )
    next_renewal_date = future_renewals[0] if future_renewals else None

    duplicate_groups: list[dict[str, str | int]] = []
    for (name, category), count in duplicates.items():
        if count > 1:
            duplicate_groups.append({"name": name, "category": category, "count": count})

    budget_doc = await get_budget_for_owner(db, owner)
    budget_status = compute_budget_status(items, rounded_categories, target_currency, budget_doc)
    top_category = (
        {"name": top_category_name, "monthly": round(top_category_monthly, 2)}
        if top_category_name
        else None
    )
    insights = build_insights(
        monthly_total=round(monthly_total, 2),
        yearly_total=round(yearly_total, 2),
        top_category=top_category,
        upcoming_renewals_count=len(upcoming_renewals),
        trial_conversions=trial_conversions,
        duplicate_groups=duplicate_groups,
        budget_status=budget_status,
        currency=target_currency,
    )

    return AnalyticsResponse(
        monthly_total=round(monthly_total, 2),
        yearly_total=round(yearly_total, 2),
        category_breakdown=rounded_categories,
        upcoming_renewals=upcoming_renewals,
        currency=target_currency,
        subscriptions_count=len(items),
        average_monthly_per_subscription=round(average_monthly, 2),
        top_category=top_category,
        upcoming_renewals_count=len(upcoming_renewals),
        next_renewal_date=next_renewal_date,
        trial_conversions=trial_conversions,
        duplicate_groups=duplicate_groups,
        insights=insights,
        budget_status=budget_status,
        savings_target_10_percent=round(monthly_total * 0.10, 2),
    )


@app.post("/subscriptions/{subscription_id}/mark-renewed", status_code=status.HTTP_204_NO_CONTENT)
async def mark_renewed(
    subscription_id: str,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    owner: Annotated[OwnerContext, Depends(get_owner_context)],
) -> Response:
    query = {
        "_id": parse_object_id(subscription_id),
        "owner_type": owner.owner_type,
        "owner_id": owner.owner_id,
    }
    existing = await db.subscriptions.find_one(query)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found.")
    renewal = existing["renewal_date"]
    delta = timedelta(days=30 if existing["billing_cycle"] == "monthly" else 365)
    new_date = renewal + delta
    await db.subscriptions.update_one(
        query,
        {
            "$set": {
                "renewal_date": new_date,
                "is_trial": False,
                "trial_end_date": None,
                "updated_at": datetime.now(UTC),
            }
        },
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
