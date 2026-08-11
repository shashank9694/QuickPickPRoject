"""
Seed script — inserts 1000+ users, 120 shops, and catalog items into MongoDB.
Run: python seed.py
"""
import asyncio, random, uuid, os
from datetime import datetime, timezone
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME   = os.environ["DB_NAME"]

client = AsyncIOMotorClient(MONGO_URL)
db     = client[DB_NAME]

def uid(): return str(uuid.uuid4())
def now(): return datetime.now(timezone.utc).isoformat()

# ── Indian cities with lat/lng ─────────────────────────────────────────────
CITIES = [
    ("Mumbai",      19.0760,  72.8777),
    ("Delhi",       28.7041,  77.1025),
    ("Bengaluru",   12.9716,  77.5946),
    ("Hyderabad",   17.3850,  78.4867),
    ("Chennai",     13.0827,  80.2707),
    ("Kolkata",     22.5726,  88.3639),
    ("Pune",        18.5204,  73.8567),
    ("Ahmedabad",   23.0225,  72.5714),
    ("Jaipur",      26.9124,  75.7873),
    ("Surat",       21.1702,  72.8311),
    ("Lucknow",     26.8467,  80.9462),
    ("Chandigarh",  30.7333,  76.7794),
    ("Indore",      22.7196,  75.8577),
    ("Nagpur",      21.1458,  79.0882),
    ("Bhopal",      23.2599,  77.4126),
]

def rand_loc(city):
    name, lat, lng = city
    return (
        name,
        lat  + random.uniform(-0.05, 0.05),
        lng  + random.uniform(-0.05, 0.05),
    )

# ── Shop categories & items ────────────────────────────────────────────────
SHOP_DATA = {
    "Grocery": {
        "names": ["Fresh Mart", "Daily Needs", "Green Basket", "Super Store", "Family Grocery",
                  "Quick Grocery", "Shree Kiryana", "Ganesh Stores", "Laxmi General Store", "Annapurna Mart"],
        "items": [
            ("Rice (Basmati)", 80, "kg"), ("Wheat Flour (Atta)", 45, "kg"), ("Sugar", 42, "kg"),
            ("Salt", 20, "kg"), ("Cooking Oil (Sunflower)", 130, "litre"), ("Toor Dal", 120, "kg"),
            ("Chana Dal", 90, "kg"), ("Moong Dal", 110, "kg"), ("Tea Powder", 250, "kg"),
            ("Biscuits (Parle-G)", 10, "pack"), ("Bread", 40, "loaf"), ("Butter", 55, "pack"),
            ("Milk", 60, "litre"), ("Paneer", 280, "kg"), ("Curd", 50, "kg"),
            ("Tomato Ketchup", 90, "bottle"), ("Mustard Oil", 150, "litre"), ("Turmeric Powder", 60, "100g"),
            ("Red Chilli Powder", 80, "100g"), ("Coriander Powder", 55, "100g"),
        ],
    },
    "Vegetables & Fruits": {
        "names": ["Hari Sabzi", "Fresh Veggie Hub", "Farm Fresh", "Nature's Basket", "Organic Corner",
                  "Kisan Fresh", "City Vegetables", "Fruit Palace", "Patel Fruits", "Green Valley"],
        "items": [
            ("Tomato", 30, "kg"), ("Onion", 25, "kg"), ("Potato", 20, "kg"), ("Spinach", 20, "bunch"),
            ("Carrot", 40, "kg"), ("Cucumber", 25, "kg"), ("Capsicum", 60, "kg"), ("Brinjal", 30, "kg"),
            ("Banana", 40, "dozen"), ("Apple", 150, "kg"), ("Mango (Alphonso)", 200, "kg"),
            ("Papaya", 30, "kg"), ("Watermelon", 20, "kg"), ("Grapes", 80, "kg"),
            ("Lemon", 10, "piece"), ("Ginger", 100, "kg"), ("Garlic", 80, "kg"), ("Coriander Leaves", 15, "bunch"),
        ],
    },
    "Restaurant": {
        "names": ["Spice Garden", "Tandoor Palace", "Biryani Hub", "Desi Dhaba", "Punjab Kitchen",
                  "South Tiffin", "Mumbai Street Food", "Royal Thali", "Chai & Snacks", "Masala Corner"],
        "items": [
            ("Veg Biryani", 120, "plate"), ("Chicken Biryani", 180, "plate"), ("Dal Makhani", 130, "plate"),
            ("Paneer Butter Masala", 160, "plate"), ("Roti", 10, "piece"), ("Naan", 20, "piece"),
            ("Butter Chicken", 200, "plate"), ("Masala Chai", 20, "cup"), ("Cold Coffee", 60, "glass"),
            ("Samosa", 15, "piece"), ("Vada Pav", 20, "piece"), ("Pav Bhaji", 80, "plate"),
            ("Chole Bhature", 90, "plate"), ("Idli Sambar", 60, "plate"), ("Dosa", 80, "plate"),
            ("Fried Rice", 100, "plate"), ("Noodles", 90, "plate"), ("Lassi", 50, "glass"),
        ],
    },
    "Pharmacy": {
        "names": ["MedPlus", "Health First", "Life Care Pharmacy", "Apollo Pharmacy", "Wellness Store",
                  "City Chemist", "Jan Aushadhi", "Swasthya Pharmacy", "Care Medical", "Aarogya Pharmacy"],
        "items": [
            ("Paracetamol 500mg", 15, "strip"), ("Crocin 650mg", 25, "strip"), ("Vitamin C 500mg", 80, "bottle"),
            ("Cetirizine 10mg", 20, "strip"), ("Omeprazole 20mg", 30, "strip"), ("Antacid Syrup", 85, "bottle"),
            ("Bandage", 20, "roll"), ("Hand Sanitizer", 60, "bottle"), ("Face Mask N95", 25, "piece"),
            ("Glucon-D", 45, "pack"), ("ORS Packet", 10, "packet"), ("Dettol Antiseptic", 80, "bottle"),
        ],
    },
    "Electronics": {
        "names": ["Tech World", "Digital Hub", "City Electronics", "Power Zone", "Smart Gadgets",
                  "Vijay Electronics", "Mobile Zone", "Star Electronics", "Rapid Tech", "E-Mart"],
        "items": [
            ("Phone Charger (Type C)", 199, "piece"), ("Earphones", 299, "piece"), ("Power Bank 10000mAh", 799, "piece"),
            ("USB Cable 1m", 99, "piece"), ("Screen Protector", 149, "piece"), ("Phone Case", 199, "piece"),
            ("LED Bulb 9W", 80, "piece"), ("Extension Board 4 Socket", 299, "piece"),
            ("AA Batteries (4 pack)", 60, "pack"), ("Pen Drive 32GB", 399, "piece"),
        ],
    },
    "Bakery": {
        "names": ["Oven Fresh", "Sweet Bakes", "Daily Bread", "Cake World", "The Bakehouse",
                  "Golden Crust", "Flavours Bakery", "Morning Fresh", "Cake & More", "Bake Studio"],
        "items": [
            ("Whole Wheat Bread", 45, "loaf"), ("Multigrain Bread", 55, "loaf"), ("Croissant", 35, "piece"),
            ("Chocolate Cake (500g)", 350, "piece"), ("Vanilla Pastry", 60, "piece"),
            ("Cookies (Choco Chip)", 120, "pack"), ("Muffin", 50, "piece"), ("Brownie", 60, "piece"),
            ("Garlic Bread", 80, "pack"), ("Puff Pastry", 25, "piece"), ("Rusks", 60, "pack"),
        ],
    },
    "Dairy": {
        "names": ["Milk Junction", "Mother Dairy", "Amul Parlour", "Fresh Dairy", "Gopala Dairy",
                  "Gokul Dairy", "Pure Milk Point", "Dairy Fresh", "Village Dairy", "Milky Way"],
        "items": [
            ("Full Cream Milk", 65, "litre"), ("Toned Milk", 55, "litre"), ("Curd (500g)", 35, "pack"),
            ("Paneer (200g)", 80, "pack"), ("Butter (100g)", 55, "pack"), ("Ghee (500g)", 280, "jar"),
            ("Lassi (200ml)", 25, "bottle"), ("Buttermilk (200ml)", 15, "bottle"),
            ("Cheese Slice", 120, "pack"), ("Ice Cream (500ml)", 120, "tub"),
        ],
    },
    "Stationery": {
        "names": ["Paper World", "Study Zone", "Office Needs", "Book Corner", "Write Right",
                  "Excel Stationery", "Smart Study", "Pen Point", "Student Hub", "Creative Corner"],
        "items": [
            ("Ball Pen (Blue)", 10, "piece"), ("Notebook A4 200pg", 80, "piece"), ("Pencil HB", 5, "piece"),
            ("Eraser", 5, "piece"), ("Ruler 30cm", 15, "piece"), ("Stapler", 120, "piece"),
            ("Stapler Pins", 20, "box"), ("Highlighter", 30, "piece"), ("Sticky Notes", 40, "pack"),
            ("A4 Paper (500 sheets)", 250, "ream"), ("File Folder", 25, "piece"),
        ],
    },
}

# ── Indian names ────────────────────────────────────────────────────────────
FIRST_NAMES = [
    "Rahul","Priya","Amit","Sunita","Vikram","Anjali","Rajesh","Pooja","Suresh","Kavita",
    "Arun","Meena","Deepak","Nisha","Sanjay","Rekha","Vinod","Anita","Mahesh","Geeta",
    "Ashok","Divya","Ramesh","Shilpa","Prakash","Seema","Girish","Meera","Dinesh","Leela",
    "Sachin","Pallavi","Nitin","Alka","Vikas","Jyoti","Rakesh","Swati","Naresh","Usha",
    "Harish","Asha","Yogesh","Sarita","Sunil","Savita","Pankaj","Ritu","Ajay","Suman",
    "Kapil","Vandana","Hemant","Lata","Bharat","Madhuri","Santosh","Kamla","Ravi","Gita",
    "Ganesh","Sarla","Vishal","Mamta","Manoj","Pushpa","Anil","Rani","Rohit","Sunila",
]

LAST_NAMES = [
    "Sharma","Verma","Singh","Gupta","Patel","Mishra","Joshi","Kumar","Yadav","Pandey",
    "Tiwari","Shah","Mehta","Chauhan","Rao","Reddy","Nair","Pillai","Iyer","Bhat",
    "Desai","Jain","Agarwal","Srivastava","Dubey","Saxena","Tripathi","Shukla","Malhotra","Kapoor",
]


def rand_name():
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"

def rand_phone(existing: set):
    while True:
        phone = f"9{random.randint(100000000, 999999999)}"
        if phone not in existing:
            existing.add(phone)
            return phone


async def seed():
    print("🌱 Starting seed...")

    # ── Check existing counts ──────────────────────────────────────────────
    existing_users = await db.users.count_documents({})
    existing_shops = await db.shops.count_documents({})
    print(f"   Existing: {existing_users} users, {existing_shops} shops")

    existing_phones: set[str] = set()
    async for u in db.users.find({}, {"phone": 1, "_id": 0}):
        existing_phones.add(u["phone"])

    # ── Generate shopkeepers ───────────────────────────────────────────────
    NUM_SHOPKEEPERS = 120
    shopkeepers = []
    sk_docs = []
    for _ in range(NUM_SHOPKEEPERS):
        phone = rand_phone(existing_phones)
        doc = {
            "id": uid(), "phone": phone, "name": rand_name(),
            "role": "shopkeeper", "created_at": now(),
        }
        shopkeepers.append(doc)
        sk_docs.append(doc)

    # ── Generate customers ─────────────────────────────────────────────────
    NUM_CUSTOMERS = 1000
    customer_docs = []
    for _ in range(NUM_CUSTOMERS):
        phone = rand_phone(existing_phones)
        city = random.choice(CITIES)
        _, lat, lng = rand_loc(city)
        customer_docs.append({
            "id": uid(), "phone": phone, "name": rand_name(),
            "role": "customer", "created_at": now(),
            "location": {"lat": lat, "lng": lng, "text": city[0]},
            "lat": lat, "lng": lng,
        })

    all_users = sk_docs + customer_docs
    if all_users:
        await db.users.insert_many(all_users, ordered=False)
        print(f"   ✅ Inserted {len(all_users)} users ({NUM_SHOPKEEPERS} shopkeepers + {NUM_CUSTOMERS} customers)")

    # ── Generate shops ─────────────────────────────────────────────────────
    categories = list(SHOP_DATA.keys())
    shop_docs = []
    catalog_docs = []

    for sk in shopkeepers:
        # Each shopkeeper gets 1 shop
        category = random.choice(categories)
        data = SHOP_DATA[category]
        shop_name = random.choice(data["names"]) + f" - {random.choice([n for n,*_ in CITIES])}"
        city = random.choice(CITIES)
        _, lat, lng = rand_loc(city)

        shop_id = uid()
        shop = {
            "id": shop_id,
            "owner_id": sk["id"],
            "owner_phone": sk["phone"],
            "name": shop_name,
            "category": category,
            "address": f"{random.randint(1,999)}, {random.choice(['MG Road','Gandhi Nagar','Nehru Street','Station Road','Market Road','Civil Lines'])}, {city[0]}",
            "lat": lat, "lng": lng,
            "location": {"lat": lat, "lng": lng, "text": city[0]},
            "location_text": city[0],
            "phone": sk["phone"],
            "status": "approved",
            "is_open": random.random() > 0.15,
            "rating": round(random.uniform(3.5, 5.0), 1),
            "avg_pack_time_min": random.choice([10, 15, 20, 30]),
            "created_at": now(),
        }
        shop_docs.append(shop)

        # Catalog items for each shop (8–15 items)
        items = data["items"]
        selected = random.sample(items, min(len(items), random.randint(8, 15)))
        for item_name, base_price, unit in selected:
            price = round(base_price * random.uniform(0.9, 1.15), 0)
            catalog_docs.append({
                "id": uid(),
                "shop_id": shop_id,
                "name": item_name,
                "price": price,
                "unit": unit,
                "category": category,
                "in_stock": random.random() > 0.1,
                "photo_url": "",
                "created_at": now(),
            })

    if shop_docs:
        await db.shops.insert_many(shop_docs, ordered=False)
        print(f"   ✅ Inserted {len(shop_docs)} shops")

    if catalog_docs:
        await db.catalog_items.insert_many(catalog_docs, ordered=False)
        print(f"   ✅ Inserted {len(catalog_docs)} catalog items")

    # ── Summary ────────────────────────────────────────────────────────────
    total_users = await db.users.count_documents({})
    total_shops = await db.shops.count_documents({})
    total_items = await db.catalog_items.count_documents({})
    print(f"\n📊 Database now has:")
    print(f"   👤 {total_users} users")
    print(f"   🏪 {total_shops} shops")
    print(f"   📦 {total_items} catalog items")
    print("\n✅ Seed complete!")

asyncio.run(seed())
