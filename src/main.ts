import express from "express";
import dotenv from "dotenv";
import {getLogger} from "./logger";
import {ServerInfo, ServerStatus} from "./types";
import ejs from "ejs";
import path from "path";
import {PromiseSocket} from "promise-socket"
import ping from "ping";

dotenv.config();

const logger = getLogger();

const PORT = parseInt(process.env.PORT ?? "8080");
const SERVER_COUNT = parseInt(process.env.SERVER_COUNT ?? "0");
const servers: ServerInfo[] = [];
for (let index = 1; index <= SERVER_COUNT; index++) {
    const server = process.env[`SERVER_${index}`];
    if (!server) {
        throw new Error(`SERVER_${index} does not exist`);
    }
    servers.push(JSON.parse(server));
}

const app = express();

app.get("/", (req, res) => {
    ejs.renderFile(path.join(process.cwd(), "src", "index.ejs"), {
        servers
    }).then(result => {
        res.end(result);
    }).catch(e => {
        res.end(e.toString());
    });
});

async function checkSSH(ip: string): Promise<boolean> {
    const socket = new PromiseSocket();
    try {
        const result = await Promise.race([new Promise((resolve, reject) =>
            setTimeout(() => resolve("failed"), 1000)), socket.connect({
            host: ip,
            port: 22
        })]);
        if (result === "failed") {
            logger.debug(`SSH check failed on ${ip}`);
            return false;
        } else {
            logger.debug(`SSH check OK on ${ip}`);
            return true;
        }
    } catch {
        logger.debug(`SSH check failed on ${ip}`);
        return false;
    } finally {
        try {
            socket.destroy();
        } catch (e) {
        }
    }
}

async function checkPing(ip: string): Promise<boolean> {
    try {
        const result = await ping.promise.probe(ip, {
            timeout: 1
        });
        logger.debug(`Ping check result on ${ip}: ${result.alive}`);
        return result.alive;
    } catch (e) {
        logger.error(e);
        return false;
    }
}

let statuses: ServerStatus[] = [...Array(servers.length)].map(() => ({
    ping: false,
    ssh: false
}));

function fetchStatuses(): void {
    const pingStatuses = Promise.all(
        servers.map(server => server.ip).map(ip => checkPing(ip))
    );
    const sshStatuses = Promise.all(
        servers.map(server => server.ip).map(ip => checkSSH(ip))
    );
    Promise.all([pingStatuses, sshStatuses]).then(([ping, ssh]) => {
        statuses = [...Array(servers.length)].map((_, index) => ({
            ping: ping[index],
            ssh: ssh[index]
        }));
    });
}

setInterval(() => fetchStatuses(), 5000);
fetchStatuses();

app.get("/statuses", (req, res) => {
    res.json(statuses);
});

app.get("/favicon.ico", (req, res) => {
    res.sendFile(path.join(process.cwd(), "src", "favicon.svg"));
});

app.get("/favicon.svg", (req, res) => {
    res.sendFile(path.join(process.cwd(), "src", "favicon.svg"));
});

app.listen(PORT, (error) => {
    if (error) {
        throw error;
    }
    logger.info(`Started on :${PORT}`);
});