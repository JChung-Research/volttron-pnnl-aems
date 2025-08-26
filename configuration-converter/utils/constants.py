from typing import Any, Dict, Set

"""
Shared constants and mappings for config transformation and ENV key translation.

These are intentionally data-only; import from this module to avoid duplication.
"""

DEFAULTS: Dict[str, Any] = {
    "local_tz": "UTC",
    "bldg_type": "Office",
    "operator": "",
    "image": "",
    "description": "",
    "default_setpoints": {
        "UnoccupiedHeatingSetPoint": 63,
        "UnoccupiedCoolingSetPoint": 80,
        "ZoneAirHeatingSetpoint": 65,
        "ZoneAirCoolingSetpoint": 78,
        "HVACMode": "auto",
    },
    "schedule": {},
    "chart_configs": {},
}

SYSTEM_REQUIRED: Set[str] = {
    "campus",
    "building",
    "system",
    "zone_point_names"
}

DAYS_MAP = {d.lower(): d for d in ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]}

CLIENT_ENV_MAP = {
    "application title": "REACT_APP_TITLE",
    "application description": "REACT_APP_DESCRIPTION",
    "application api url": "REACT_APP_API_URL",
    "application login": "REACT_APP_LOGIN",
    "app title": "REACT_APP_TITLE",
    "app description": "REACT_APP_DESCRIPTION",
    "app api url": "REACT_APP_API_URL",
    "app login": "REACT_APP_LOGIN",
    "port": "PORT",
    "app port": "PORT",
}

SERVER_ENV_MAP = {
    "project name": "PROJECT_NAME",
    "server hostname": "HOSTNAME",
    "server port": "PORT",
    "database host": "DATABASE_HOST",
    "database url": "DATABASE_URL",
    "database port": "DATABASE_PORT",
    "database name": "DATABASE_NAME",
    "database schema": "DATABASE_SCHEMA",
    "database username": "DATABASE_USERNAME",
    "database password": "DATABASE_PASSWORD",
    "config auth url": "CONFIG_AUTH_URL",
    "config api url": "CONFIG_API_URL",
    "config username": "CONFIG_USERNAME",
    "config password": "CONFIG_PASSWORD",
    "setup files": "SETUP_FILES",
}

BUILDING_UNIT_MAP = {
    "campus": "campus",
    "building": "building",
    "system": "system",
    "local timezone": "local_tz",
    "building type": "bldg_type",
    "operator": "operator",
    "image": "image",
    "description": "description",
    "schedule": "schedule",
    "chart configs": "chart_configs",
    "chart type": "chartConfigType",
    "selected variables": "chartSelectVars",
    "visualization setting": "chartVizSetting",
    "variable x": "var_x",
    "variable y": "var_y",
    "variable": "var",
    "default setpoints": "default_setpoints",
    "zone point names": "zone_point_names",
    "data point": "data_point",
}

QUOTED_CONF_KEYS = {"instance-name"}
