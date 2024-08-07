import {I2CBus} from "i2c-bus"
import {sleep} from "../../src/helper_functions.js";
import os from "os";

export default class DS3502 {
    private i2c_device: I2CBus

    private static MAX_VAL = 127
    private static MIN_VAL =  0

    constructor(private adress: number = 0x28, private bus_num: number = 1) {
        if (os.arch().startsWith("arm")) {
            import("i2c-bus").then((i2c) => {
                this.i2c_device = i2c.openSync(this.bus_num)
                this.i2c_device.writeByteSync(this.adress, this.DS3502_MODE, 0x80)
            });
        }
    }

    DS3502_WIPER = 0x00
    DS3502_MODE = 0x02

    read() {
        return this.i2c_device.readByteSync(this.adress, this.DS3502_WIPER)
    }

    //v = 0-1
    write(v: number) {
        try {
            this.i2c_device.writeByteSync(this.adress, this.DS3502_WIPER, this.to_safe(v))
            return true
        } catch (e) {
            return false
        }
    }

    private to_safe(v:number) {
        return Math.max(Math.min(DS3502.MAX_VAL, Math.round(v*DS3502.MAX_VAL)), DS3502.MIN_VAL)
    }

    async setDefault(v) {
        if (v < 0 || v > 127) {
            return false
        } else {
            try {
                this.i2c_device.writeByteSync(this.adress, this.DS3502_MODE, 0x00)
                this.i2c_device.writeByteSync(this.adress, this.DS3502_WIPER, this.to_safe(v))
                await sleep(100);
                this.i2c_device.writeByteSync(this.adress, this.DS3502_MODE, 0x80)
                return true
            } catch (e) {
                return false
            }
        }
    }
}