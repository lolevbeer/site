import requests
from dotenv import load_dotenv
from geopy.geocoders import Bing, Nominatim
import html
import json
import time
import os

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

def geocode_address(address, customer, existing_data, retries=3):
    for entry in existing_data['features']:
        if entry['properties']['address'] == address:
            return entry['geometry']['coordinates'], entry['properties']['address'], False

    coordinates, location, success = geocode_address_bing(address, customer)
    if not success:
        print("Bing geocoding failed, trying Nominatim...")
        coordinates, location, success = geocode_address_nominatim(address, customer)

    if success and "PA" not in location:
        print(f"Discarding address not in Pennsylvania: {location}")
        return None, None, False

    return coordinates, location, success

def process_data(data, existing_data):
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
    return {"type": "FeatureCollection", "features": []}

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
