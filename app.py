from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import json
import os
import logging
from datetime import datetime
from collections import Counter

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(name)s - %(message)s')
logger = logging.getLogger(__name__)

# Data file
DATA_FILE = 'data.json'

def load_data():
    """Load data from data.json."""
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r') as f:
                data = json.load(f)
            logger.info(f"Loaded {len(data)} records from {DATA_FILE}")
            return data
        except Exception as e:
            logger.error(f"Failed to load {DATA_FILE}: {str(e)}")
            return []
    logger.warning(f"{DATA_FILE} not found")
    return []

def derive_availability(price):
    """Derive availability based on price."""
    try:
        price = float(price)
        if price < 2500:
            return "High"
        elif price <= 4000:
            return "Medium"
        else:
            return "Low"
    except (TypeError, ValueError):
        return "Unknown"

def capitalize_words(text):
    """Capitalize each word in a string."""
    return ' '.join(word.capitalize() for word in text.split())

def parse_year(date_str):
    """Extract year from date string (e.g., '2023-01-15')."""
    try:
        return datetime.strptime(date_str, '%Y-%m-%d').year if date_str else None
    except (ValueError, TypeError):
        return None

@app.route('/')
def serve_welcome():
    """Serve the welcome page."""
    logger.debug("Serving welcome.html")
    return send_from_directory(app.template_folder, 'welcome.html')

@app.route('/dashboard')
def serve_dashboard():
    """Serve the dashboard page."""
    logger.debug("Serving dashboard.html")
    return send_from_directory(app.template_folder, 'dashboard.html')

@app.route('/prices')
def serve_prices():
    """Serve the prices page."""
    logger.debug("Serving prices.html")
    return send_from_directory(app.template_folder, 'prices.html')

@app.route('/analytics')
def serve_analytics_page():
    """Serve the analytics page."""
    logger.debug("Serving analytics.html")
    return send_from_directory(app.template_folder, 'analytics.html')

@app.route('/about')
def serve_about():
    """Serve the about page."""
    logger.debug("Serving about.html")
    return send_from_directory(app.template_folder, 'about.html')

@app.route('/static/<path:path>')
def serve_static(path):
    """Serve static files from static folder."""
    logger.debug(f"Requested static file: {path}")
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        logger.error(f"Static file not found: {path}")
        return "File not found", 404

@app.route('/api/food-prices', methods=['GET'])
def get_food_prices():
    """Fetch and filter data from data.json with pagination."""
    data = load_data()
    if not data:
        logger.error("No data available in data.json")
        return jsonify({"error": "No data available"}), 500

    state = request.args.get('state', 'all').lower()
    market = request.args.get('market', 'all').lower()
    food_item = request.args.get('food_item', 'all').lower()
    year = request.args.get('year', 'all')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))

    # Filter data
    filtered_data = []
    for item in data:
        item_state = item.get("state", "").lower()
        item_market = item.get("market", "").lower()
        item_food = item.get("food_item", "").lower()
        item_year = parse_year(item.get("date", ""))

        state_match = state == 'all' or item_state == state
        market_match = market == 'all' or item_market == market
        food_match = food_item == 'all' or item_food == food_item
        year_match = year == 'all' or (year.isdigit() and item_year == int(year))

        if state_match and market_match and food_match and year_match:
            filtered_data.append({
                "foodItem": capitalize_words(item.get("food_item", "")),
                "state": capitalize_words(item.get("state", "")),
                "region": capitalize_words(item.get("market", "")),
                "price": item.get("price", 0),
                "availability": derive_availability(item.get("price")),
                "date": item.get("date", ""),
                "lga": item.get("lga", ""),
                "unit": item.get("unit", ""),
                "currency": item.get("currency", "")
            })

    logger.debug(f"Filtered data count: {len(filtered_data)} with state={state}, market={market}, food_item={food_item}, year={year}")
    if not filtered_data:
        logger.warning("No data matched the filters")
        return jsonify({"data": [], "total_pages": 0, "current_page": 1, "total_records": 0})

    # Pagination
    start = (page - 1) * per_page
    end = start + per_page
    paginated_data = filtered_data[start:end]
    total_pages = (len(filtered_data) + per_page - 1) // per_page

    response = {
        "data": paginated_data,
        "total_pages": total_pages,
        "current_page": page,
        "total_records": len(filtered_data)
    }
    logger.info(f"Returning {len(paginated_data)} records (page {page} of {total_pages}) after filtering")
    return jsonify(response)

@app.route('/api/foods', methods=['GET'])
def get_foods():
    """Get unique food items."""
    data = load_data()
    foods = sorted(list(set(capitalize_words(item.get("food_item", "")) for item in data if item.get("food_item"))))
    logger.info(f"Returning {len(foods)} unique food items")
    return jsonify(foods)

@app.route('/api/markets', methods=['GET'])
def get_markets():
    """Get unique markets."""
    data = load_data()
    markets = sorted(list(set(capitalize_words(item.get("market", "")) for item in data if item.get("market"))))
    logger.info(f"Returning {len(markets)} unique markets")
    return jsonify(markets)

@app.route('/api/states', methods=['GET'])
def get_states():
    """Get unique states."""
    data = load_data()
    states = sorted(list(set(capitalize_words(item.get("state", "")) for item in data if item.get("state"))))
    logger.info(f"Returning {len(states)} unique states")
    return jsonify(states)

@app.route('/api/years', methods=['GET'])
def get_years():
    """Get unique years from date field."""
    data = load_data()
    years = sorted(list(set(parse_year(item.get("date", "")) for item in data if parse_year(item.get("date", "")))))
    logger.info(f"Returning {len(years)} unique years")
    return jsonify([year for year in years if year])  # Filter out None

@app.route('/api/dashboard-metrics', methods=['GET'])
def get_dashboard_metrics():
    """Get dashboard metrics."""
    data = load_data()
    if not data:
        return jsonify({"error": "No data available"}), 500

    year = request.args.get('year', 'all')
    filtered_data = [
        item for item in data
        if year == 'all' or (year.isdigit() and parse_year(item.get("date", "")) == int(year))
    ]

    food_items = len(set(item.get("food_item", "") for item in filtered_data if item.get("food_item")))
    markets = len(set(item.get("market", "") for item in filtered_data if item.get("market")))
    prices = [float(item.get("price", 0)) for item in filtered_data if item.get("price")]
    avg_price = round(sum(prices) / len(prices)) if prices else 0
    highest_price_item = max(filtered_data, key=lambda x: float(x.get("price", 0)), default={})
    lowest_price_item = min(filtered_data, key=lambda x: float(x.get("price", 0)), default={})
    food_counts = Counter(item.get("food_item", "") for item in filtered_data if item.get("food_item"))
    most_available_food = food_counts.most_common(1)[0][0] if food_counts else ""

    metrics = {
        "foodItems": food_items,
        "markets": markets,
        "avgPrice": avg_price,
        "highestPrice": {
            "item": capitalize_words(highest_price_item.get("food_item", "")),
            "price": float(highest_price_item.get("price", 0)),
            "market": capitalize_words(highest_price_item.get("market", ""))
        } if highest_price_item else {},
        "lowestPrice": {
            "item": capitalize_words(lowest_price_item.get("food_item", "")),
            "price": float(lowest_price_item.get("price", 0)),
            "market": capitalize_words(lowest_price_item.get("market", ""))
        } if lowest_price_item else {},
        "mostAvailable": capitalize_words(most_available_food)
    }
    logger.info("Returning dashboard metrics")
    return jsonify(metrics)

@app.route('/api/top-prices', methods=['GET'])
def get_top_prices():
    """Get top 5 priced items."""
    data = load_data()
    if not data:
        return jsonify({"error": "No data available"}), 500

    year = request.args.get('year', 'all')
    filtered_data = [
        item for item in data
        if year == 'all' or (year.isdigit() and parse_year(item.get("date", "")) == int(year))
    ]

    top_prices = sorted(
        [
            {
                "foodItem": capitalize_words(item.get("food_item", "")),
                "market": capitalize_words(item.get("market", "")),
                "price": float(item.get("price", 0)),
                "availability": derive_availability(item.get("price"))
            }
            for item in filtered_data if item.get("price")
        ],
        key=lambda x: x["price"],
        reverse=True
    )[:5]

    logger.info(f"Returning top 5 priced items")
    return jsonify(top_prices)

@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    """Get analytics data (e.g., average price by state with filters) with pagination."""
    data = load_data()
    if not data:
        logger.error("No data available in data.json")
        return jsonify({"error": "No data available"}), 500

    state = request.args.get('state', 'all').lower()
    market = request.args.get('market', 'all').lower()
    food_item = request.args.get('food_item', 'all').lower()
    year = request.args.get('year', 'all')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))

    # Filter data
    filtered_data = [
        {
            "state": capitalize_words(item.get("state", "")),
            "market": capitalize_words(item.get("market", "")),
            "foodItem": capitalize_words(item.get("food_item", "")),
            "price": float(item.get("price", 0)),
            "date": item.get("date", "")
        }
        for item in data
        if (state == 'all' or item.get("state", "").lower() == state) and
           (market == 'all' or item.get("market", "").lower() == market) and
           (food_item == 'all' or item.get("food_item", "").lower() == food_item) and
           (year == 'all' or (year.isdigit() and parse_year(item.get("date", "")) == int(year)))
    ]

    state_prices = {}
    for item in filtered_data:
        state = item["state"]
        price = item["price"]
        if state and price > 0:
            state_prices[state] = state_prices.get(state, []) + [price]

    analytics_data = {
        "averagePricesByState": {
            state: round(sum(prices) / len(prices)) if prices else 0
            for state, prices in state_prices.items()
        }
    }

    # Convert to list for pagination
    paginated_data = list(analytics_data["averagePricesByState"].items())
    total_records = len(paginated_data)
    start = (page - 1) * per_page
    end = start + per_page
    paginated_items = paginated_data[start:end]
    total_pages = (total_records + per_page - 1) // per_page

    response = {
        "averagePricesByState": dict(paginated_items),
        "total_pages": total_pages,
        "current_page": page,
        "total_records": total_records
    }
    logger.info(f"Returning {len(paginated_items)} records (page {page} of {total_pages}) for analytics")
    return jsonify(response)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)