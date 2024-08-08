import {I2CBus} from "i2c-bus";
import os from "os";
import EventEmitter from "node:events";
import {sleep} from "node-mavlink";

export default class VCUCoMcu extends EventEmitter {
    private i2c_device: I2CBus

    private interval: any

    constructor(private adress: number = 12, private bus_num: number = 1) {
        super()
        if (os.arch().startsWith("arm")) {
            import("i2c-bus").then(async (i2c) => {
                this.i2c_device = i2c.openSync(this.bus_num)
                await sleep(10)
                const result = this.i2c_device.scanSync(adress)
                if (!result.includes(adress)) {
                    this.emit("error", new Error("Co MCU is not found at adress, " + adress))
                }
            })
        }
    }

    startPoll(interval: number = 10) {
        this.interval = setInterval(async () => {
            await this.read_analog_sensors()
            await sleep(interval)
            await this.read_ind_sensors()
        }, interval*2)
    }

    async read_analog_sensors() {
        try {
            if (this.i2c_device) {
                const buffer = Buffer.alloc(3)
                this.i2c_device.readI2cBlockSync(this.adress, 123, 3, buffer)
                this.emit("analog_sensors", [buffer.readUInt8(2), buffer.readUInt8(1), buffer.readUInt8(0)])
            }
        } catch (e) {
            this.emit("error", e)
        }
    }

    async read_ind_sensors() {
        try {
            if(this.i2c_device) {
                const buffer = Buffer.alloc(8)
                this.i2c_device.readI2cBlockSync(this.adress, 124, 8, buffer)
                this.emit("ind_sensors", [buffer.readUInt16LE(6), buffer.readUInt16LE(4), buffer.readUInt16LE(2), buffer.readUInt16LE(0)])
            }
        } catch (e) {
            this.emit("error", e)
        }
    }
}
