import asyncio
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

tab = pd.read_csv('bacnet_topic.csv') # The topic file should be prepared for your project

LOCAL_ADDRESS = '0.0.0.0:47808'
DEVICE_ADDRESS = '127.0.0.1:47808' # Update the device IP address for your project
OBJECT_IDENTIFIER = 'analogInput'

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
    '''Gather BACnet data points via asynchonous communication''' 
    proxy = BACnetProxy(LOCAL_ADDRESS)
    try:
        results = {}
        # Read presentValue for each row in 'tab'(bacnet_topic.csv) dataframe
        for i in range(len(tab)):
            OBJECT_INSTANCE = int(tab['index'].iloc[i])
            name = str(tab['name'].iloc[i])
            try:
                val = await proxy.read(DEVICE_ADDRESS, f"{OBJECT_IDENTIFIER}:{OBJECT_INSTANCE}", 'presentValue')
            except Exception as e:
                val = None 
            results[name] = val
        return results
    finally:
        await proxy.shutdown()


def _gather_points() -> dict:
    return asyncio.run(_gather_points_async())


class building_data(Resource):
    '''Interface to get the operation information from BACnet devices.''' 
    def get(self):
        now = strftime("%Y-%m-%d-%H-%M-%S", gmtime())

        data = _gather_points()

        # Extract only voltage and electric current data
        voltage_l1 = float(data.get("voltage l1", 0.0))
        voltage_l2 = float(data.get("voltage l2", 0.0))
        voltage_l3 = float(data.get("voltage l3", 0.0))
        current_s1 = float(data.get("sensor s1", 0.0))
        current_s2 = float(data.get("sensor s2", 0.0))
        current_s3 = float(data.get("sensor s3", 0.0))

        # Compute electric powers
        power_hvac1 = voltage_l1 * current_s1
        power_hvac2 = voltage_l2 * current_s2
        power_hvac3 = voltage_l3 * current_s3

        output = {
            "power_hvac1": power_hvac1,
            "power_hvac2": power_hvac2,
            "power_hvac3": power_hvac3
        }

        print("Output from BACnet API: ", output)

        return {'status': 200, 'message': None, 'payload': {'output': output, 'time': now}}

api.add_resource(building_data, '/get_point')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5006, debug=False)