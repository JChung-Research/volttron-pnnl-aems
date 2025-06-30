"use server";

import { NextApiRequest, NextApiResponse } from "next";

import { authUser } from "@/auth";
import { logger } from "@/logging";
import { prisma } from "@/prisma";
import { Units } from "@prisma/client";
import httpsAgent from "../../../services/agent";
import axios from "axios";
import fs from "fs-extra";
import path from "path";

const CONFIG = {
  apiUrl: process.env.CONFIG_API_URL ?? "https://host.docker.internal:8443/gs",
  authUrl: process.env.CONFIG_AUTH_URL ?? "https://host.docker.internal:8443/auth",
  username: process.env.CONFIG_USERNAME ?? "admin",
  password: process.env.CONFIG_PASSWORD ?? "admin",
  timeout: 5000,
};

// Parse CSV files into array of objects
const parseCsv = async (filePath: string): Promise<string[][]> => {
  const raw = await fs.readFile(filePath, "utf8");
  return raw.trim().split("\n").map((line) => line.split(","));
};

async function getMetadataMap(metadataPath: string): Promise<{
      unitMap: Record<string, string>;
      typeMap: Record<string, string>;
    }> {
  const metadataCsv = await parseCsv(metadataPath);
  const metadataRows = metadataCsv.slice(1);
  const unitMap: Record<string, string> = {};
  const typeMap: Record<string, string> = {};

  metadataRows.forEach(([name, , unit, type]) => {
    unitMap[name] = unit;
    typeMap[name] = type;
  });
  return { unitMap, typeMap };
}

async function buildLineChartData(tsPath: string, unitMap: Record<string, string>) {
  const tsCsv = await parseCsv(tsPath);
  const tsHeader = tsCsv[0];
  const tsRows = tsCsv.slice(1);

  return tsRows.map((row, i) => {
    const time = row[0];
    const values: { [key: string]: number } = {};

    for (let j = 1; j < tsHeader.length; j++) {
      const varName = tsHeader[j];
      const rawValue = parseFloat(row[j]);
      const unit = unitMap[varName];
      //const value = unit === "°F" ? tempKtoF(rawValue) : rawValue;
      values[varName] = rawValue //value;
    }
    return {      
      index: i,
      time,
      values,
    };
  });
}

async function buildCtrlData(tsPath: string, typeMap: Record<string, string>) {
  const tsCsv = await parseCsv(tsPath);
  const tsHeader = tsCsv[0];
  const tsRows = tsCsv.slice(1);
  const lastRow = tsRows[tsRows.length - 1];

  const entry: { [key: string]: number } = { };

  for (let j = 1; j < tsHeader.length; j++) {
    const varName = tsHeader[j];
    const rawValue = parseFloat(lastRow[j]);
    const varType = typeMap[varName];

    if (varType == "control") {
        entry[varName] = rawValue;
      }
  }

  return entry;

}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await authUser(req);
  if (!user.roles.user) {
    return res.status(401).json(null);
  }

  if (req.method === "GET") {
    try {
      const output = await prisma.units.findMany({
            select: {
              campus: true,
              building: true,
              system: true,
              id: true,
            },
            orderBy: [{ campus: "asc" }, { building: "asc" }, { name: "asc" }, { id: "asc" }],
            ...(!user.roles.admin && {
              where: { users: { some: { id: user.id } } },
            }),
          })

      // Get authentication token
      const authResponse = await axios.post(
        CONFIG.authUrl,
        {
          username: CONFIG.username,
          password: CONFIG.password,
        },
        { timeout: CONFIG.timeout,
            ...(httpsAgent && { httpsAgent: httpsAgent, keepAlive: false }), 
        }
      );

      const token: string = authResponse?.data?.access_token;
      if (!token) throw new Error("Failed to get auth token");

      // Directory to store CSV files of sensor data
      const TMP_DIR = path.resolve(process.cwd(), "tmp");
      const resSensorData: Record<number, any> = {};
      await fs.ensureDir(TMP_DIR);
      const metadataPath = path.join(TMP_DIR, "metadata.csv");

      for (const unit of output) {
        // Skip if latest timestamp is within 10 seconds
        const unitId = unit.id;
        const systemId = `manager.${unit.system.toLowerCase()}`;
        const timeseriesPath = path.join(TMP_DIR, `timeseries-${systemId}.csv`);
        

        if (await fs.pathExists(timeseriesPath)) {
          const lines = (await fs.readFile(timeseriesPath, "utf8")).trim().split("\n");
          const lastLine = lines[lines.length - 1];
          const lastTimestamp = lastLine.split(",")[0]; // assuming timestamp is first column
          const lastTime = new Date(lastTimestamp).getTime();
          const now = new Date().getTime();

          if (!isNaN(lastTime) && now - lastTime < 10 * 1000) {
            console.log(`Skipping unit ${unit.id} (updated ${((now - lastTime) / 1000).toFixed(1)} seconds ago)`);
            // Read metadata

            const { unitMap, typeMap } = await getMetadataMap(metadataPath);
            const lineChartData = await buildLineChartData(timeseriesPath, unitMap);
            const ctrlData = await buildCtrlData(timeseriesPath, typeMap);

            resSensorData[unitId] = {
              id: unitId,
              building: unit.building,
              system: unit.system,
              ctrlValues: ctrlData,
              lineChartData: lineChartData,
            };

            continue;
          }
        }

        const body = {
          jsonrpc: "2.0",
          id: systemId,
          method: "get_temperature_setpoints", 
          params: {
            authentication: token,
            data: {},
          },
        };

        try {
          const response = await axios.post(CONFIG.apiUrl, body, { 
            timeout: CONFIG.timeout,
            ...(httpsAgent && { httpsAgent, keepAlive: false }), 
        });

          if (response.data?.payload) {                               
            // Create or update the metadata CSV file
            const newMetadata: string[] = response.data.payload.map(
              (item: any) => `${item.name},${item.label},${item.unit},${item.type}`
            );

            if (!(await fs.pathExists(metadataPath))) {
              await fs.writeFile(metadataPath, "name,label,unit,type\n" + newMetadata.join("\n") + "\n");
            } else {
              const existing = new Set(
                (await fs.readFile(metadataPath, "utf8"))
                  .split("\n")
                  .filter(Boolean)
                  .slice(1)
                  .map((line) => line.split(",")[0]) 
              );

              // Avoid adding duplicated metadata to the CSV file
              const uniqueRows = newMetadata.filter((row) => {
                const name = row.split(",")[0];
                return !existing.has(name);
              });

              if (uniqueRows.length > 0) {
                await fs.appendFile(metadataPath, uniqueRows.join("\n") + "\n");
              }
            }

            // Create or update timeseries CSV files
            const tsHeader = ["timestamp", ...response.data.payload.map((item: any) => item.name)];
            const tsRow = [response.data.timestamp, ...response.data.payload.map((item: any) => item.value)];

            if (!(await fs.pathExists(timeseriesPath))) {
              // Create new file with header and first row if there is no existing file
              await fs.writeFile(timeseriesPath, tsHeader.join(",") + "\n" + tsRow.join(",") + "\n");
            } else {
              const rows = (await fs.readFile(timeseriesPath, "utf8")).split("\n").filter(Boolean);
              const header = rows[0];
              const existingRows = rows.slice(1);

              // Enforce max 30 rows (excluding header)
              if (existingRows.length >= 30) {
                existingRows.shift(); // remove the oldest row if the number of the rows reaches 30
              }

              existingRows.push(tsRow.join(","));
              await fs.writeFile(timeseriesPath, [header, ...existingRows].join("\n") + "\n");
            }            

            // Read updated metadata file
            const { unitMap, typeMap } = await getMetadataMap(metadataPath);
            const lineChartData = await buildLineChartData(timeseriesPath, unitMap);
            const ctrlData = await buildCtrlData(timeseriesPath, typeMap);

            // Create resSensorData object
            resSensorData[unitId] = {
              id: unitId,
              building: unit.building,
              system: unit.system,
              ctrlValues: ctrlData,
              lineChartData: lineChartData,
            };

          } else {
            resSensorData[unitId] = resSensorData[unitId] ?? {};
            resSensorData[unitId].linechartData = { error: response.data?.error ?? "No result" };
          }
        } catch (err: any) {
          console.warn(`Failed for unit ${unit.id}`, err);
          resSensorData[unitId].linechartData = { error: err.message || err };
        }
      }
      
      const resMetadata = new Set(
                (await fs.readFile(metadataPath, "utf8"))
                  .split("\n")
                  .filter(Boolean)
                  .slice(1)
                  .map((line) => {
                    const [name, label, unit, type] = line.split(",");
                    return { name, label, unit, type };
                  }) 
              )
      return res.status(200).json({metadata: Array.from(resMetadata), sensorData: resSensorData});
    } catch (error) {
      logger.warn(error);
      return res.status(400).json({ error: "Failed to fetch sensor data", details: error });
    }
  } else {
    return res.status(404).json(null);
  }
}
