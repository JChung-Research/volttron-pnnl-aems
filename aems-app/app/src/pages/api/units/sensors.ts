"use server";

import { NextApiRequest, NextApiResponse } from "next";

import { authUser } from "@/auth";
import { logger } from "@/logging";
import { prisma } from "@/prisma";
import httpsAgent from "../../../services/agent";
import axios from "axios";

const CONFIG = {
  apiUrl: process.env.CONFIG_API_URL ?? "https://host.docker.internal:8443/gs",
  authUrl: process.env.CONFIG_AUTH_URL ?? "https://host.docker.internal:8443/auth",
  username: process.env.CONFIG_USERNAME ?? "admin",
  password: process.env.CONFIG_PASSWORD ?? "admin",
  timeout: 5000,
};

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
              configuration: true,
            },
            orderBy: [{ campus: "asc" }, { building: "asc" }, { name: "asc" }, { id: "asc" }],
            ...(user?.roles?.user ? {} : { 
              where: { users: { some: { id: user.id } } } 
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

      type PayloadItem = {
        name: string;
        label: string;
        type: string;
        unit: string;
        value: number | string | null;
        history?: Array<{ time: string; value: number | string | null }>;
      };

      function buildCtrlValuesFromPayload(payload: PayloadItem[]) {
        const out: Record<string, number | string | null> = {};
        for (const item of payload) {
          if (item.type === "control") {
            // prefer latest history value if present, otherwise current value
            const latest = item.history?.[item.history.length - 1]?.value ?? item.value ?? null;
            out[item.name] = latest as any;
          }
        }
        return out;
      }

      function buildLineChartDataFromPayload(payload: PayloadItem[]) {
        // Collect all timestamps across all series
        const timeSet = new Set<string>();
        const seriesByName = new Map<string, Map<string, number | string | null>>();

        for (const item of payload) {
          const m = new Map<string, number | string | null>();
          for (const h of item.history ?? []) {
            timeSet.add(h.time);
            // keep null as null
            m.set(h.time, (h.value ?? null) as any);
          }
          seriesByName.set(item.name, m);
        }

        const times = Array.from(timeSet).sort();

        const rows = times.map((time, index) => {
          const values: Record<string, number | string | null> = {};
          for (const item of payload) {
            const s = seriesByName.get(item.name);
            values[item.name] = s?.has(time) ? (s.get(time) as any) : null;
          }
          return { index, time, values };
        });

        // Drop rows where everything is null OR only Occupancy is non-null
        const filtered = rows.filter((row) => {
          for (const [k, v] of Object.entries(row.values)) {
            if (k === "Occupancy") continue; // ignore occupancy-only rows
            if (v == null) continue;         // null/undefined not meaningful
            if (typeof v === "number" && !Number.isFinite(v)) continue; // ignore NaN/Inf
            return true; // found at least one real non-Occupancy value
          }
          return false;
        });

        // reindex so client doesn't see gaps in index
        return filtered.map((row, i) => ({ ...row, index: i }));
      }

      const resSensorData: Record<number, any> = {};
      const metaByName = new Map<string, { name: string; label: string; unit: string; type: string }>();

      for (const unit of output) {
        const unitId = unit.id;
        const systemId = `manager.${unit.system.toLowerCase()}`;
        const qStart = typeof req.query.start_time === "string" ? req.query.start_time : undefined;
        const qEnd   = typeof req.query.end_time === "string" ? req.query.end_time : undefined;

        const timeRange =
          (qStart && qEnd)
            ? { start_time: qStart, end_time: qEnd }
            : (unit.configuration?.dataTimeRange ?? null);

        const body = {
          jsonrpc: "2.0",
          id: systemId,
          method: "get_temperature_setpoints",
          params: {
            authentication: token,
            data: timeRange,
          },
        };

        try {
          const response = await axios.post(CONFIG.apiUrl, body, {
            timeout: CONFIG.timeout,
            ...(httpsAgent && { httpsAgent, keepAlive: false }),
          });

          const payload: PayloadItem[] | undefined = response.data?.payload;
          if (Array.isArray(payload) && payload.length > 0) {
            // 1) aggregate metadata
            for (const it of payload) {
              if (!metaByName.has(it.name)) {
                metaByName.set(it.name, { name: it.name, label: it.label, unit: it.unit, type: it.type });
              }
            }

            // 2) build ctrlValues + lineChartData
            const ctrlValues = buildCtrlValuesFromPayload(payload);
            const lineChartData = buildLineChartDataFromPayload(payload);

            // 3) assign to resSensorData
            resSensorData[unitId] = {
              id: unitId,
              building: unit.building,
              system: unit.system,
              ctrlValues,
              lineChartData,
            };
          } else {
            resSensorData[unitId] = resSensorData[unitId] ?? {};
            resSensorData[unitId].lineChartData = { error: response.data?.error ?? "No result" };
          }
        } catch (err: any) {
          console.warn(`Failed for unit ${unit.id}`, err);
          resSensorData[unitId] = resSensorData[unitId] ?? {};
          resSensorData[unitId].lineChartData = { error: err?.message || String(err) };
        }
      }

      // Build metadata array
      const resMetadata = Array.from(metaByName.values());
      return res.status(200).json({ metadata: resMetadata, sensorData: resSensorData });
    } catch (error) {
      logger.warn(error);
      return res.status(400).json({ error: "Failed to fetch sensor data", details: error });
    }
  } else {
    return res.status(404).json(null);
  }
}
