import requests
from geopy.geocoders import Bing
import html
import json
import time
import os

def fetch_json(url):
    response = requests.get(url)
    return response.json()

def geocode_address(address, existing_data):
    # Check if the address is already processed
    for entry in existing_data['features']:
        print(entry)
        if entry['properties']['address'] == address:
            return entry['geometry']['coordinates'], False

    # Geocode the address
    geolocator = Bing('Av2eo3w_fFrvjEd9IYrfc7va9dJcotS1gwxcZYbJc6U00g5xYtGFrPSGBri9aToH', user_agent="lolev")
    try:
        location = geolocator.geocode(address, timeout=10)
        if location:
            print(location)
            return [location.longitude, location.latitude], True

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
        address = item.get('AddressCityStateZip')
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
                coordinates, made_new_request = geocode_address(address, processed_data)
                if coordinates:
                    feature = {
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": coordinates
                        },
                        "properties": {
                            "id": index,
                            "Name": html.unescape(item.get('CustomerName', '')),
                            "address": address,
                            "customerType": html.unescape(item.get('CustomerType', ''))
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
    url = "https://sarenecraftdist.com/API?APICommand=ReportView&ReportName=Testing&BaseQuery=Sales&Action=CrossTab&ReportID=16898519&Format=JSON&EncompassID=SareneCraft&QuickKey=39dbb6efa067dccc2651d18fa2b30672&Parameters=F:Display~V:Chart~O:E|F:ColTotals~V:Auto~O:E|F:ColumnHeadingFormat~V:3~O:E|F:Decimals~V:2~O:E|F:Format~V:HTML~O:E|F:Parent1~V:Company~O:E|F:Parent2~V:Address~O:E|F:Parent3~V:CustomerType~O:E|F:Column~V:CaseEquiv~O:E|F:Period~V:08Weeks~O:E|F:YearInt~V:1~O:E|F:CloseDay~V:4~O:E|F:OrderBy~V:2~O:E&"
    original_data = fetch_json(url)

    existing_data = load_existing_data('processed_geo_data.json')
    rows = original_data.get('Export', {}).get('Table', {}).get('Row', [])
    new_geojson_data = process_data(rows, existing_data)

    with open('processed_geo_data.json', 'w') as f:
        json.dump(new_geojson_data, f, indent=4)

if __name__ == "__main__":
    main()
