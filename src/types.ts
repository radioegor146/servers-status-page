export interface ServerInfo {
    ip: string;
    platform: string;
    name: string;
    description: string;
}

export interface ServerStatus {
    ping: boolean;
    ssh: boolean;
}