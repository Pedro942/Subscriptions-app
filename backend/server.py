from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Literal

import firebase_admin
from bson import ObjectId
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
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


settings = Settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


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


class SubscriptionCreate(BaseModel):
    platform_id: str | None = None
    custom_name: str | None = None
    custom_category: str | None = None
    renewal_date: date
    amount: float = Field(gt=0)
    billing_cycle: Literal["monthly", "yearly"] = "monthly"
    currency: str = "EUR"


class SubscriptionUpdate(BaseModel):
    renewal_date: date | None = None
    amount: float | None = Field(default=None, gt=0)
    billing_cycle: Literal["monthly", "yearly"] | None = None
    currency: str | None = None


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


class AnalyticsResponse(BaseModel):
    monthly_total: float
    yearly_total: float
    category_breakdown: dict[str, dict[str, float]]
    upcoming_renewals: list[dict[str, str | float]]
    currency: str
    subscriptions_count: int


class OwnerContext(BaseModel):
    owner_type: Literal["device", "user"]
    owner_id: str
    user: dict | None = None


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
CURRENCY_RATES_TO_EUR = {
    "EUR": 1.0,
    "USD": 0.92,
    "GBP": 1.16,
    "CHF": 1.03,
    "CAD": 0.68,
    "AUD": 0.61,
    "JPY": 0.0061,
}


app = FastAPI(title="Subscription Hub API", version="0.1.0")
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
    return upper if upper in CURRENCY_RATES_TO_EUR else "EUR"


def convert_currency(amount: float, src: str, target: str) -> float:
    src_rate = CURRENCY_RATES_TO_EUR.get(normalize_currency(src), 1.0)
    target_rate = CURRENCY_RATES_TO_EUR.get(normalize_currency(target), 1.0)
    amount_in_eur = amount * src_rate
    return amount_in_eur / target_rate


def serialize_subscription(document: dict) -> SubscriptionOut:
    return SubscriptionOut(
        id=str(document["_id"]),
        name=document["name"],
        category=document["category"],
        renewal_date=document["renewal_date"],
        amount=document["amount"],
        billing_cycle=document["billing_cycle"],
        currency=document["currency"],
        platform_slug=document.get("platform_slug"),
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


@app.on_event("startup")
async def startup_event() -> None:
    client = AsyncIOMotorClient(settings.mongo_uri)
    app.state.mongo_client = client
    app.state.db = client[settings.mongo_database]

    await app.state.db.users.create_index("email", unique=True)
    await app.state.db.subscriptions.create_index([("owner_type", 1), ("owner_id", 1)])
    await app.state.db.subscriptions.create_index("renewal_date")
    await app.state.db.platforms.create_index("slug", unique=True)
    await seed_platform_catalog(app.state.db)
    ensure_firebase_initialized()


@app.on_event("shutdown")
async def shutdown_event() -> None:
    app.state.mongo_client.close()


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


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
) -> list[SubscriptionOut]:
    cursor = db.subscriptions.find(
        {"owner_type": owner.owner_type, "owner_id": owner.owner_id}
    ).sort("renewal_date", 1)
    subscriptions: list[SubscriptionOut] = []
    async for item in cursor:
        subscriptions.append(serialize_subscription(item))
    return subscriptions


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
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }
    result = await db.subscriptions.insert_one(document)
    saved = await db.subscriptions.find_one({"_id": result.inserted_id})
    return serialize_subscription(saved)


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
    if updates:
        updates["updated_at"] = datetime.now(UTC)
        await db.subscriptions.update_one(query, {"$set": updates})
    updated = await db.subscriptions.find_one(query)
    return serialize_subscription(updated)


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


@app.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    owner: Annotated[OwnerContext, Depends(get_owner_context)],
    currency: str = "EUR",
) -> AnalyticsResponse:
    target_currency = normalize_currency(currency)
    cursor = db.subscriptions.find({"owner_type": owner.owner_type, "owner_id": owner.owner_id})
    items: list[dict] = []
    async for item in cursor:
        items.append(item)

    monthly_total = 0.0
    yearly_total = 0.0
    category_breakdown: dict[str, dict[str, float]] = {}
    upcoming_renewals: list[dict[str, str | float]] = []
    upcoming_limit_date = date.today() + timedelta(days=30)

    for item in items:
        converted_amount = convert_currency(item["amount"], item["currency"], target_currency)
        monthly_cost = converted_amount if item["billing_cycle"] == "monthly" else converted_amount / 12
        yearly_cost = monthly_cost * 12
        monthly_total += monthly_cost
        yearly_total += yearly_cost

        category = item.get("category", "Other")
        bucket = category_breakdown.setdefault(category, {"monthly": 0.0, "yearly": 0.0})
        bucket["monthly"] += monthly_cost
        bucket["yearly"] += yearly_cost

        renewal = item["renewal_date"]
        if date.today() <= renewal <= upcoming_limit_date:
            upcoming_renewals.append(
                {
                    "id": str(item["_id"]),
                    "name": item["name"],
                    "renewal_date": renewal.isoformat(),
                    "amount": round(converted_amount, 2),
                    "currency": target_currency,
                }
            )

    rounded_categories = {
        key: {"monthly": round(values["monthly"], 2), "yearly": round(values["yearly"], 2)}
        for key, values in category_breakdown.items()
    }
    upcoming_renewals.sort(key=lambda value: value["renewal_date"])

    return AnalyticsResponse(
        monthly_total=round(monthly_total, 2),
        yearly_total=round(yearly_total, 2),
        category_breakdown=rounded_categories,
        upcoming_renewals=upcoming_renewals,
        currency=target_currency,
        subscriptions_count=len(items),
    )
