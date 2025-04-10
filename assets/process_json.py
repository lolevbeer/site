import requests
from dotenv import load_dotenv
from geopy.geocoders import Bing, Nominatim
import html
import json
import time
import os
import csv
import glob

def fetch_json(url):
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an error for bad responses (4xx and 5xx)
        
        # Log the response content for debugging
        print("Response Content:", response.text[:200])  # Print the first 200 characters

        return response.json()
    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error occurred: {http_err}")
    except requests.exceptions.RequestException as req_err:
        print(f"Request error occurred: {req_err}")
    except ValueError as json_err:
        print(f"JSON decode error: {json_err}")
        print("Response was not valid JSON:", response.text[:200])  # Print the first 200 characters
    return None

def geocode_address_bing(address, customer):
    print(f"Geocoding with Bing: {address}")
    bing_key = os.getenv('BING')
    print(f"Bing API key: {bing_key[:5]}...{bing_key[-5:] if bing_key and len(bing_key) > 10 else '(key too short or empty)'}")
    
    if not bing_key or bing_key == "YourBingMapsAPIKeyHere":
        print("ERROR: Invalid Bing API key. Please set a valid key in your .env file or environment variables.")
        return None, None, False
    
    geolocator = Bing(bing_key, user_agent="lolev")
    try:
        location = geolocator.geocode(customer + ', ' + address, timeout=10)
        if location:
            print(f"Found address with Bing: {location}")
            return [location.longitude, location.latitude], location.address, True
        else:
            print(f"Geocoding with Bing failed for address: {address}")
    except Exception as e:
        print(f"Error geocoding with Bing {address}: {e}")
    return None, None, False

def geocode_address_nominatim(address, customer):
    print(f"Geocoding with Nominatim: {address}")
    geolocator = Nominatim(user_agent="lolev")
    try:
        location = geolocator.geocode(customer + ', ' + address, timeout=10)
        if location:
            print(f"Found address with Nominatim: {location}")
            return [location.longitude, location.latitude], location.address, True
        else:
            print(f"Geocoding with Nominatim failed for address: {address}")
    except Exception as e:
        print(f"Error geocoding with Nominatim {address}: {e}")
    return None, None, False

def geocode_address(address, customer, existing_data, pa_only=False, retries=3):
    for entry in existing_data['features']:
        if entry['properties']['address'] == address:
            return entry['geometry']['coordinates'], entry['properties']['address'], False

    # Try Nominatim first as it doesn't require API key
    coordinates, location, success = geocode_address_nominatim(address, customer)
    
    # Fall back to Bing if Nominatim fails and we have a Bing key
    if not success and os.getenv('BING'):
        print("Nominatim geocoding failed, trying Bing...")
        coordinates, location, success = geocode_address_bing(address, customer)

    # If PA filter is enabled and we have a successful geocode, check for PA
    if success and pa_only and "PA" not in location:
        print(f"Discarding non-PA address: {location}")
        return None, None, False

    return coordinates, location, success

def load_csv_data(filepath):
    try:
        data = []
        with open(filepath, 'r', encoding='utf-8') as csvfile:
            # Print the first line to debug the column names
            first_line = csvfile.readline().strip()
            print(f"CSV Headers: {first_line}")
            csvfile.seek(0)  # Reset file position
            
            # Parse CSV
            reader = csv.DictReader(csvfile)
            print(f"CSV Columns: {reader.fieldnames}")
            
            for i, row in enumerate(reader):
                # Create a structure similar to the JSON format
                # Combine address components
                full_address = f"{row.get('Address', '')}, {row.get('City', '')}, {row.get('State', '')} {row.get('Zip Code', '')}"
                
                # Map market types to customer types for consistent icon usage
                market_type = "Retail"  # Default type
                
                # Check for market type column
                market_type_value = None
                # Try standard column names
                for col_name in ['Market Types', 'Market Type', 'Market_Types', 'Market_Type', 'MarketTypes', 'MarketType']:
                    if col_name in row and row[col_name]:
                        market_type_value = row[col_name]
                        print(f"Found market type in column '{col_name}': {market_type_value}")
                        break
                
                # If we found a market type, map it to a customer type
                if market_type_value:
                    market_type = map_market_type_to_customer_type(market_type_value)
                
                item = {
                    'CustomerName': row.get('Retail Accounts', ''),
                    'AddressCityStateZip': full_address,
                    'CustomerType': market_type
                }
                data.append(item)
        return data
    except Exception as e:
        print(f"Error loading CSV data from {filepath}: {e}")
        import traceback
        traceback.print_exc()
    return []

def map_market_type_to_customer_type(market_type):
    """Maps CSV market types to customer types used for map icons"""
    if not market_type:
        return "Retail"
        
    market_type = market_type.upper().strip()
    
    # Map market types to appropriate customer types for icon display
    if market_type in ["SUPERMARKET", "GROCERY-GENERAL"]:
        return "Grocery"
    elif market_type in ["RESTAURANT", "RESTAURANT/BAR", "ITALIAN"]:
        return "Restaurant"
    elif "BAR" in market_type or market_type in ["COCKTAIL LOUNGE", "SPORTS BAR", "BAR/TAVERN/C.L.", "THEME BAR-"]:
        return "Bar"
    elif market_type in ["CONVENIENCE-GEN", "GAS & CONVENIEN"]:
        return "Convenience"
    elif market_type in ["MARINA/LAKE", "BOWLING ALLEY", "DRIVE-THRU", "DELI"]:
        return "Recreation"
    elif market_type in ["GOLF-PUBLIC", "CTRY/GOLF CLUB"]:
        return "Golf"
    else:
        return "Retail"  # Default fallback

def process_data(data, existing_data, pa_only=False):
    processed_data = {"type": "FeatureCollection", "features": []}
    existing_addresses = {feature['properties']['address'].lower(): feature for feature in existing_data['features']}

    for index, item in enumerate(data):
        customer = item.get('CustomerName', '')
        address = item.get('AddressCityStateZip')
        customer_type = item.get('CustomerType', '')
        if address:
            address = html.unescape(address).lower()
            if address in existing_addresses:
                existing_address = existing_addresses[address]
                existing_address['properties']['address'] = existing_address['properties']['address'].lower()
                processed_data['features'].append(existing_address)
            else:
                coordinates, location, made_new_request = geocode_address(address, customer, processed_data, pa_only)
                if coordinates:
                    feature = {
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": coordinates
                        },
                        "properties": {
                            "id": index,
                            "Name": html.unescape(customer).lower(),
                            "address": location,
                            "customerType": html.unescape(customer_type)
                        }
                    }
                    processed_data['features'].append(feature)

    return processed_data

def load_existing_data(filepath):
    if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
        with open(filepath, 'r') as file:
            return json.load(file)
    return {"type": "FeatureCollection", "features": []}

def process_ingest_directory():
    ingest_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'ingest')
    
    if not os.path.exists(ingest_dir):
        print(f"Ingest directory not found: {ingest_dir}")
        return {"type": "FeatureCollection", "features": []}
    
    # Load existing NY data if it exists
    ny_data = load_existing_data('ny_geo_data.json')
    
    print(f"Searching for CSV files in: {ingest_dir}")
    csv_files = glob.glob(os.path.join(ingest_dir, '*.csv'))
    
    for csv_file in csv_files:
        print(f"Processing CSV file: {csv_file}")
        csv_data = load_csv_data(csv_file)
        if csv_data:
            ny_data = process_data(csv_data, ny_data, pa_only=False)
    
    return ny_data

def main():
    # Load environment variables
    load_dotenv()
    
    # Debug environment variables
    print("Environment variables:")
    print(f"BING set: {'Yes' if os.getenv('BING') else 'No'}")
    if os.getenv('BING') == "YourBingMapsAPIKeyHere":
        print("WARNING: You're using the placeholder Bing API key. Please update it in your .env file.")
    
    # Load existing PA geocoded data
    pa_data = load_existing_data('processed_geo_data.json')
    
    # Process JSON data from URL (PA only)
    url = os.getenv('SARENE_LOCATIONS')
    if url:
        original_data = fetch_json(url)
        if original_data:
            rows = original_data.get('Export', {}).get('Table', {}).get('Row', [])
            pa_data = process_data(rows, pa_data, pa_only=True)
            
            # Save the updated PA data
            with open('processed_geo_data.json', 'w') as f:
                json.dump(pa_data, f, indent=4)
            print(f"Saved PA data to processed_geo_data.json with {len(pa_data['features'])} features")
    
    # Process all CSV files in the ingest directory (NY data)
    ny_data = process_ingest_directory()
    
    # Save the NY data to a separate file
    with open('ny_geo_data.json', 'w') as f:
        json.dump(ny_data, f, indent=4)
    print(f"Saved NY data to ny_geo_data.json with {len(ny_data['features'])} features")

if __name__ == "__main__":
    main()
