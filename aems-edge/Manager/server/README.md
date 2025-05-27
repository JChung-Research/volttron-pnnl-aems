# AEMS Edge Virtual Server Installation

To run the `start_server_virtual.py` component, please follow the same steps outlined in the [AEMS Edge Install Usign Poetry](https://github.com/JChung-Research/volttron-pnnl-aems/tree/main/aems-edge/Manager).

## Prerequisites
Before starting the server, ensure that a valid SSL certificate and private key are installed. This is required to enable HTTPS and avoid any technical issues from insecure communication between the server and client.

## Run the virutal server
Once the installation is complete, you can start the virtual server using the following command:
```bash
poetry run start-server-virtual --certfile [path-to-certfile] --keyfile [path-to-keyfile]
```
Replace [path-to-certfile] and [path-to-keyfile] with the actual paths to your SSL certificate and key files.

## API Testing and Examples
To test API interactions with the server (e.g., authentication and JSON-RPC requests), refer to the detailed annotations provided in the `start_server_virtual.py` file. This includes example request formats, supported methods, and expected payload structures.