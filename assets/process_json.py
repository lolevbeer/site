import requests
from dotenv import load_dotenv
from geopy.geocoders import Bing
import html
import json
import time
import os

def fetch_json(url):
    response = requests.get(url)
    return response.json()

def geocode_address(address, customer, existing_data):
    # Check if the address is already processed
    for entry in existing_data['features']:
        if entry['properties']['address'] == address:
            return entry['geometry']['coordinates'], False

    print(f"Geocoding address: {address}")
    k = os.getenv('BING')
    # Geocode the address
    geolocator = Bing(k, user_agent="lolev")
    try:
        location = geolocator.geocode(customer + ', ' + address, timeout=10)
        if location:
            print(f"Found address: {location}")
            return [location.longitude, location.latitude], location.address, True
        else:
            print(f"Geocoding failed for address: {address}")
    except Exception as e:
        print(f"Error geocoding {address}: {e}")
    return None, False

def process_data(data, existing_data):
    processed_data = {"type": "FeatureCollection", "features": []}  # Initialize processed_data

    # Convert existing data to a dictionary for faster lookup
    existing_addresses = {feature['properties']['address'].lower(): feature for feature in existing_data['features']}

    for index, item in enumerate(data):
        customer = item.get('CustomerName', '')
        address = item.get('AddressCityStateZip')
        customer_type = item.get('CustomerType', '')
        if address:
            address = html.unescape(address).lower()
            # Check if this address is already processed
            if address in existing_addresses:
                # Add the existing feature to the processed data without re-geocoding
                existing_address = existing_addresses[address]
                existing_address['properties']['address'] = existing_address['properties']['address'].lower()
                processed_data['features'].append(existing_address)
            else:
                # Geocode new address
                coordinates, location, made_new_request = geocode_address(address, customer, processed_data)
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
    return {"type": "FeatureCollection", "features": []}  # Return a GeoJSON structure

def main():
    url = os.getenv('SARENE_LOCATIONS')
    original_data = fetch_json(url)

    existing_data = load_existing_data('processed_geo_data.json')
    rows = original_data.get('Export', {}).get('Table', {}).get('Row', [])
    new_geojson_data = process_data(rows, existing_data)

    with open('processed_geo_data.json', 'w') as f:
        json.dump(new_geojson_data, f, indent=4)

if __name__ == "__main__":
    load_dotenv()
    main()
