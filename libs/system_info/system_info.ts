import EventEmitter from "node:events";
import osu from "node-os-utils";
import fs from "fs";

export interface SystemInfoData {
    cpu: {
        cores: number,
        usage: number,
        temp: number
    }
    ram: {
        usage: number
        total: number
    }
    storage: {
        type: number,
        usage: number
        total: number
    }
}

export default class SystemInfo extends EventEmitter {

    constructor() {
        super();

        setInterval(async () => {
            const mem_info = await osu.mem.used()
            const storage_info = await osu.drive.info("/")

            this.emit("data", {
                cpu: {
                    cores: osu.cpu.count(),
                    usage: await osu.cpu.usage(),
                    temp: parseInt(fs.readFileSync("/sys/class/thermal/thermal_zone0/temp", {encoding: "utf-8"})) / 1000
                },
                ram: {
                    usage: mem_info.usedMemMb,
                    total: mem_info.totalMemMb
                },
                storage: {
                    type: 4,
                    usage: parseInt(storage_info.usedGb) * 1000,
                    total: parseInt(storage_info.totalGb) * 1000
                }
            } as SystemInfoData)
        }, 1000)
    }
}