from datetime import datetime
import asyncio, random
from time import gmtime, strftime
from flask import Flask
from flask_restful import Resource, Api
import pandas as pd

from bacpypes3.app import Application
from bacpypes3.constructeddata import AnyAtomic
from bacpypes3.pdu import Address
from bacpypes3.apdu import ErrorRejectAbortNack
from bacpypes3.primitivedata import Null, ObjectIdentifier, ObjectType
from bacpypes3.vendor import get_vendor_info

LOCAL_ADDRESS = '0.0.0.0:47808'
OBJECT_IDENTIFIER = 'analogInput'
DEVICES_CSV = "egauge_device.csv"
TOPIC_CSV = "egauge_topic.csv"

activate_get_point = False

def _norm(s: str) -> str:
    return (s or "").strip().lower()

def load_points(csv_path: str):
    """
    Backward compatible loader:

    - New format (recommended):
        name, object_type, instance, property, writable, notes ...

    - Old format:
        name, index
      In that case we assume:
        object_type='analogInput', property='presentValue'
    """
    df = pd.read_csv(csv_path)

    # New format
    if "instance" in df.columns and "object_type" in df.columns:
        points = []
        for _, row in df.iterrows():
            points.append({
                "name": str(row.get("name", "")).strip(),
                "object_type": str(row.get("object_type", "analogInput")).strip(),
                "instance": int(row.get("instance")),
                "property": str(row.get("property", "presentValue")).strip(),
                "writable": str(row.get("writable", "")).strip(),
            })
        return points

    # Old format fallback
    points = []
    for _, row in df.iterrows():
        points.append({
            "name": str(row.get("name", "")).strip(),
            "object_type": "analogInput",
            "instance": int(row.get("index")),
            "property": "presentValue",
            "writable": "",
        })
    return points

def oid(point: dict) -> str:
    return f"{point['object_type']}:{int(point['instance'])}"

# Load once at startup
_POINTS = load_points(TOPIC_CSV)

def load_devices(csv_path: str):
    df = pd.read_csv(csv_path)
    required = {"zone_id", "device_address", "device_instance"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"{csv_path} missing required columns: {sorted(missing)}")

    devices = []
    for _, row in df.iterrows():
        devices.append({
            "zone_id": str(row["zone_id"]).strip(),
            "device_address": str(row["device_address"]).strip(),
            "device_instance": int(row["device_instance"]),
        })
    if not devices:
        raise ValueError(f"No devices found in {csv_path}")
    return devices

# Backward compatible fallback if the CSV is missing or malformed
try:
    DEVICES = load_devices(DEVICES_CSV)
except Exception as e:
    print(f"[WARN] Could not load {DEVICES_CSV}: {e}")
    DEVICES = [{"zone_id": "zone_1", "device_address": "127.0.0.1:47808", "device_instance": 0}]


# Fake response for '/get_point'
get_point_response = {
    "voltage l1": 10.0,
    "voltage l2": 1.0,
    "voltage l3": 2.0,
    "sensor s3": 0.8009964227676392,
    "sensor s2": 2.089770555496216,
    "sensor s1": 0.20827734470367432,
    "frequency l1": 0.0,
    "frequency l2": 0.0,
    "frequency l3": 0.0,
    "frequency s3": 1.0693128108978271,
    "frequency s2": 0.0,
    "frequency s1": 60.20947265625,
    "timestamp": 2672.084716796875,
    "oldval usage": 0.9291016459465027,
    "oldval l1 voltage": 543686592.0,
    "oldval l2 voltage": 8487799.0,
    "oldval l3 voltage": 8428707.0,
    "oldval internal temperature": 21916270592.0,
    "oldval internal humidity": 30523531264.0,
    "oldchg usage": 0.0,
    "oldchg l1 votage": 0.0,
    "oldchg l2 votage": 0.0,
    "oldchg l3 votage": 0.0,
    "oldchg internal temperature": 27.177000045776367,
    "oldchg internal humidity": 44.38399887084961,
    "mean voltage l1": -0.0,
    "mean voltage l2": -0.0,
    "mean voltage l3": -0.0,
    "mean sensor s3": 0.24315595626831055,
    "mean sensor s2": -2.0895583629608154,
    "mean sensor s1": 0.0,
    "regval l1 voltage": 543686592.0,
    "regval l2 voltage": 8487799.0,
    "regval l3 voltage": 8428707.0,
    "regval internal temperature": 21916270592.0,
    "regval internal humidity": 30523576320.0,
    "regchg l1 voltage": 0.0,
    "regchg l2 voltage": 0.0,
    "regchg l3 voltage": 0.0,
    "regchg internal temperature": 27.177000045776367,
    "regchg internal humidity": 44.38399887084961
}

class BACnetProxy:
    def __init__(self, local_address, bacnet_network=1, vendor_id=999, object_name='Excelsior',
                 device_info_cache=None, router_info_cache=None, ase_id=None):

        vendor_info = get_vendor_info(vendor_id)
        device_object_class = vendor_info.get_object_class(ObjectType.device)
        device_object = device_object_class(objectIdentifier=('device', vendor_id), objectName=object_name)
        network_port_object_class = vendor_info.get_object_class(ObjectType.networkPort)
        network_port_object = network_port_object_class(
            local_address,
            objectIdentifier=("network-port", bacnet_network),
            objectName="NetworkPort-1",
            networkNumber=bacnet_network,
            networkNumberQuality="configured"
        )

        self.app = Application.from_object_list(
            [device_object, network_port_object],
            device_info_cache=device_info_cache,
            router_info_cache=router_info_cache,
            aseID=ase_id
        )

    async def write(self, device_address: str, object_identifier: str, property_identifier: str, value: any,
                    priority: int, property_array_index: int | None = None):
        print("WRITING: address: {device_address}, ")
        value = Null(()) if value is None or value == 'null' else value
        try:
            return await self.app.write_property(
                Address(device_address),
                ObjectIdentifier(object_identifier),
                property_identifier,
                value,
                int(property_array_index) if property_array_index is not None else None,
                int(priority)
            )
        except ErrorRejectAbortNack as err:
            print(str(err))

    async def read(self, device_address: str, object_identifier: str, property_identifier: str,
                   property_array_index: int | None = None):
        try:
            response = await self.app.read_property(
                Address(device_address),
                ObjectIdentifier(object_identifier),
                property_identifier,
                property_array_index,
            )
        except ErrorRejectAbortNack as err:
            response = err
        if isinstance(response, AnyAtomic):
            response = response.get_value()
        return response

    async def shutdown(self):
        '''Release network resources so subsequent requests can recreate the Application.'''
        try:
            # BACpypes3 Application implements close(); if not present, ignore.
            await self.app.close()
        except AttributeError:
            pass
        except Exception:
            # Do not fail the request just because close raised.
            pass

app = Flask(__name__)
api = Api(app)

async def _gather_points_async() -> dict:
    """Gather BACnet data points from multiple eGauge devices."""
    proxy = BACnetProxy(LOCAL_ADDRESS)
    try:
        all_results = {}

        for dev in DEVICES:
            zone_id = dev["zone_id"]
            device_address = dev["device_address"]

            results = {}
            for p in _POINTS:
                name = p["name"]
                try:
                    val = await proxy.read(device_address, oid(p), p["property"])
                except Exception:
                    val = None
                results[name] = val

            all_results[zone_id] = results

        return all_results
    finally:
        await proxy.shutdown()

def _gather_points() -> dict:
    return asyncio.run(_gather_points_async())

def randomize (value):
    return value * round(random.uniform(0.95, 1.05), 4)

def get_power_hvac (data, bool_rndm):
    # Extract only voltage and electric current data
    voltage_l1 = float(data.get("voltage l1", 0.0))
    voltage_l2 = float(data.get("voltage l2", 0.0))
    voltage_l3 = float(data.get("voltage l3", 0.0))
    current_s1 = float(data.get("sensor s1", 0.0))
    current_s2 = float(data.get("sensor s2", 0.0))
    current_s3 = float(data.get("sensor s3", 0.0))

    # Compute electric powers
    if not bool_rndm:
        power_data = {
            "power_hvac1": randomize(voltage_l1 * current_s1),
            "power_hvac2": randomize(voltage_l2 * current_s2),
            "power_hvac3": randomize(voltage_l3 * current_s3)
        }
    else:
        power_data = {
            "power_hvac1": voltage_l1 * current_s1,
            "power_hvac2": voltage_l2 * current_s2,
            "power_hvac3": voltage_l3 * current_s3
        }

    return power_data


class building_data(Resource):
    '''Interface to get the operation information from BACnet devices.''' 
    def get(self):
        now = strftime("%Y-%m-%d-%H-%M-%S", gmtime())

        if activate_get_point:
            raw_by_zone = _gather_points()  # {zone_id: {point_name: value}}
            output = {z: get_power_hvac(raw, activate_get_point) for z, raw in raw_by_zone.items()}
        else:
            # Fake mode: generate fake power per zone_id
            output = {dev["zone_id"]: get_power_hvac(get_point_response.copy(), activate_get_point) for dev in DEVICES}

        print("Output from BACnet API: ", output)
        return {'status': 200, 'message': None, 'payload': {'output': output, 'time': now}}

class health(Resource): 
    def get(self): 
        ts_local = datetime.now().astimezone().isoformat()

        return {'status': 200, 'message': None, 'payload': {"time": ts_local}}

api.add_resource(building_data, '/get_point')
api.add_resource(health, '/ping')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5006, debug=False)