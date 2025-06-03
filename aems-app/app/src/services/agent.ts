import { readFileSync } from "fs";
// import { Agent } from "https";
import * as https from "https";
import { resolve } from "path";

const volttronCa = process.env.VOLTTRON_CA && readFileSync(resolve(__dirname, process.env.VOLTTRON_CA));
// const httpsAgent = volttronCa ? new Agent({ ca: volttronCa, keepAlive: false }) : undefined;
const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });

export default httpsAgent;
