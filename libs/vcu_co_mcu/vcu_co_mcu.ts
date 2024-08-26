import {I2CBus, openSync} from "i2c-bus";
import os from "os";
import EventEmitter from "node:events";
import {sleep} from "node-mavlink";

export default class VCUCoMcu extends EventEmitter {
    private i2c_device: I2CBus | null = null
    private analog_interval: any
    private ind_interval: any
    initialized = false

    constructor(private adress: number = 12, private bus_num: number = 1) {
        super()
        if (os.arch().startsWith("arm")) {
            this.i2c_device = openSync(this.bus_num)
            this.initialized = true
        }
    }

    startPoll(analog_interval: number = 10, ind_interval: number = 200) {
        this.analog_interval = setInterval(async () => {
            if (this.initialized) {
                this.read_ts_active()
                await sleep(analog_interval)
                this.read_analog_sensors()
            }
        }, analog_interval*2)

        this.ind_interval = setInterval(async () => {
            if (this.initialized) {
                this.read_ind_sensors()
            }
        }, ind_interval)
    }

    read_ts_active() {
        try {
            if (this.i2c_device) {
                this.emit("ts_active", this.i2c_device.readByteSync(this.adress, 125))
            }
        } catch (e) {
            this.emit("error", e)
        }
    }

    read_analog_sensors() {
        try {
            if (this.i2c_device) {
                const buffer = Buffer.alloc(4)
                this.i2c_device.readI2cBlockSync(this.adress, 123, 4, buffer)
                this.emit("analog_sensors", [buffer.readUInt8(3), buffer.readUInt8(2), buffer.readUInt8(1), buffer.readUInt8(0)])
            }
        } catch (e) {
            this.emit("error", e)
        }
    }

    read_ind_sensors() {
        try {
            if(this.i2c_device) {
                const buffer = Buffer.alloc(6)
                this.i2c_device.readI2cBlockSync(this.adress, 124, 6, buffer)
                this.emit("ind_sensors", [buffer.readUInt16LE(4), buffer.readUInt16LE(2), buffer.readUInt16LE(0)])
            }
        } catch (e) {
            this.emit("error", e)
        }
    }
}
