import {I2CBus} from "i2c-bus"
import {sleep} from "../../src/helper_functions.js";
import os from "os";
import EventEmitter from "node:events";

export default class DS3502 extends EventEmitter {
    private i2c_device: I2CBus | null = null

    private static MAX_VAL = 127
    private static MIN_VAL = 0

    private DS3502_WIPER = 0x00
    private DS3502_MODE = 0x02

    constructor(private adress: number = 0x28, private bus_num: number = 1) {
        super()
        if (os.arch().startsWith("arm")) {
            import("i2c-bus").then(async (i2c) => {
                this.i2c_device = i2c.openSync(this.bus_num)
                await sleep(10)
                const result = this.i2c_device.scanSync(adress)
                if (result.includes(adress)) {
                    this.i2c_device.writeByteSync(this.adress, this.DS3502_MODE, 0x80)
                } else {
                    this.emit("error", new Error("DS3502 device not found at adress, " + adress))
                }
            });
        }
    }

    read(): number {
        try {
            if (this.i2c_device) {
                return this.i2c_device.readByteSync(this.adress, this.DS3502_WIPER)
            } else {
                return -1
            }
        } catch (e) {
            return -1
        }
    }

    //v = 0-1
    write(v: number) {
        try {
            if (this.i2c_device) {
                this.i2c_device.writeByteSync(this.adress, this.DS3502_WIPER, this.to_safe(v))
                return true
            }
            return false
        } catch (e) {
            return false
        }
    }

    private to_safe(v: number) {
        return Math.max(Math.min(DS3502.MAX_VAL, Math.round(v * DS3502.MAX_VAL)), DS3502.MIN_VAL)
    }

    async setDefault(v: number) {
        if (v < 0 || v > 1) {
            return false
        } else {
            try {
                if (this.i2c_device) {
                    this.i2c_device.writeByteSync(this.adress, this.DS3502_MODE, 0x00)
                    this.i2c_device.writeByteSync(this.adress, this.DS3502_WIPER, this.to_safe(v))
                    await sleep(100);
                    this.i2c_device.writeByteSync(this.adress, this.DS3502_MODE, 0x80)
                    return true
                } else {
                    return false
                }
            } catch (e) {
                return false
            }
        }
    }
}