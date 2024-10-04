import {I2CBus, openSync} from "i2c-bus";
import ROUnaryStruct from "../LSM6DS032/ro_unary_struct.js";
import RWBit from "../LSM6DS032/rwbit.js";
import RWBits from "../LSM6DS032/rwbits.js";
import ROBits from "../LSM6DS032/robits.js";
import os from "os";
import EventEmitter from "node:events";
import ROBit from "../LSM6DS032/robit.js";

export default class INA260 extends EventEmitter {
    private readonly _REG_CONFIG = 0x00  // CONFIGURATION REGISTER (R/W)
    private readonly _REG_CURRENT = 0x01  // SHUNT VOLTAGE REGISTER (R)
    private readonly _REG_BUS_VOLTAGE = 0x02  // BUS VOLTAGE REGISTER (R)
    private readonly _REG_POWER = 0x03  // POWER REGISTER (R)
    private readonly _REG_MASK_ENABLE = 0x06  // MASK ENABLE REGISTER (R/W)
    private readonly _REG_ALERT_LIMIT = 0x07  // ALERT LIMIT REGISTER (R/W)
    private readonly _REG_MFG_UID = 0xFE  // MANUFACTURER UNIQUE ID REGISTER (R)
    private readonly _REG_DIE_UID = 0xFF  // DIE UNIQUE ID REGISTER (R)

    SHUTDOWN = 0x0
    TRIGGERED = 0x3
    CONTINUOUS = 0x7

    TIME_140_us = 0x0
    TIME_204_us = 0x1
    TIME_332_us = 0x2
    TIME_588_us = 0x3
    TIME_1_1_ms = 0x4
    TIME_2_116_ms = 0x5
    TIME_4_156_ms = 0x6
    TIME_8_244_ms = 0x7

    COUNT_1 = 0x0
    COUNT_4 = 0x1
    COUNT_16 = 0x2
    COUNT_64 = 0x3
    COUNT_128 = 0x4
    COUNT_256 = 0x5
    COUNT_512 = 0x6
    COUNT_1024 = 0x7

    seconds_dict = {
        0: 140e-6,
        1: 204e-6,
        2: 332e-6,
        3: 588e-6,
        4: 1.1e-3,
        5: 2.116e-3,
        6: 4.156e-3,
        7: 8.244e-3,
    }

    averaging_count_dict = {0: 1, 1: 4, 2: 16, 3: 64, 4: 128, 5: 256, 6: 512, 7: 1024}

    private _raw_current: ROUnaryStruct | null = null
    private _raw_voltage: ROUnaryStruct | null = null
    private _raw_power: ROUnaryStruct | null = null

    private over_current_limit: RWBit | null = null
    private under_current_limit: RWBit | null = null
    private bus_voltage_over_voltage: RWBit | null = null
    private bus_voltage_under_voltage: RWBit | null = null
    private power_over_limit: RWBit | null = null
    private conversion_ready: RWBit | null = null
    private alert_function_flag: ROBit | null = null
    private _conversion_ready_flag: ROBit | null = null
    private math_overflow_flag: ROBit | null = null
    private alert_polarity_bit: RWBit | null = null
    private alert_latch_enable: RWBit | null = null
    private reset_bit: RWBit | null = null

    private averaging_count: RWBits | null = null
    private voltage_conversion_time: RWBits | null = null
    private current_conversion_time: RWBits | null = null
    private mode: RWBits | null = null
    private mask_enable: RWBits | null = null
    private alert_limit: RWBits | null = null

    TEXAS_INSTRUMENT_ID = 0x5449
    INA260_ID = 0x227
    private _manufacturer_id: ROUnaryStruct | null = null
    private _device_id: ROBits | null = null
    private revision_id: ROBits | null = null

    private interval: any
    initialized = false

    private i2c_device: I2CBus | null = null

    constructor(adress: number = 0x40, bus_num: number = 1) {
        super();
        if (os.arch().startsWith("arm")) {
            this.i2c_device = openSync(bus_num)
            const result = this.i2c_device.scanSync(adress)
            if (!result.includes(adress)) {
                this.emit("error", new Error("LSM6DS032 device not found at adress, " + adress))
                this.i2c_device = null
            } else {
                this._raw_current = new ROUnaryStruct(this.i2c_device, adress, this._REG_CURRENT, ">h")
                this._raw_voltage = new ROUnaryStruct(this.i2c_device, adress, this._REG_BUS_VOLTAGE, ">H")
                this._raw_power = new ROUnaryStruct(this.i2c_device, adress, this._REG_POWER, ">H")

                this.over_current_limit = new RWBit(this.i2c_device, adress, this._REG_MASK_ENABLE, 15, 2, false)
                this.under_current_limit = new RWBit(this.i2c_device, adress, this._REG_MASK_ENABLE, 14, 2, false)
                this.bus_voltage_over_voltage = new RWBit(this.i2c_device, adress, this._REG_MASK_ENABLE, 13, 2, false)
                this.bus_voltage_under_voltage = new RWBit(this.i2c_device, adress, this._REG_MASK_ENABLE, 12, 2, false)
                this.power_over_limit = new RWBit(this.i2c_device, adress, this._REG_MASK_ENABLE, 11, 2, false)
                this.conversion_ready = new RWBit(this.i2c_device, adress, this._REG_MASK_ENABLE, 10, 2, false)
                this.alert_function_flag = new ROBit(this.i2c_device, adress, this._REG_MASK_ENABLE, 4, 2, false)
                this._conversion_ready_flag = new ROBit(this.i2c_device, adress, this._REG_MASK_ENABLE, 3, 2, false)
                this.math_overflow_flag = new ROBit(this.i2c_device, adress, this._REG_MASK_ENABLE, 2, 2, false)
                this.alert_polarity_bit = new RWBit(this.i2c_device, adress, this._REG_MASK_ENABLE, 1, 2, false)
                this.alert_latch_enable = new RWBit(this.i2c_device, adress, this._REG_MASK_ENABLE, 0, 2, false)
                this.reset_bit = new RWBit(this.i2c_device, adress, this._REG_CONFIG, 15, 2, false)
                this.averaging_count = new RWBits(this.i2c_device, adress, 3, this._REG_CONFIG, 9, 2, false)
                this.voltage_conversion_time = new RWBits(this.i2c_device, adress, 3, this._REG_CONFIG, 6, 2, false)
                this.current_conversion_time = new RWBits(this.i2c_device, adress, 3, this._REG_CONFIG, 3, 2, false)
                this.mode = new RWBits(this.i2c_device, adress, 3, this._REG_CONFIG, 0, 2, false)
                this.mask_enable = new RWBits(this.i2c_device, adress, 16, this._REG_MASK_ENABLE, 0, 2, false)
                this.alert_limit = new RWBits(this.i2c_device, adress, 16, this._REG_ALERT_LIMIT, 0, 2, false)
                this._manufacturer_id = new ROUnaryStruct(this.i2c_device, adress, this._REG_MFG_UID, ">H")
                this._device_id = new ROBits(this.i2c_device, adress, 12, this._REG_DIE_UID, 4, 2, false)
                this.revision_id = new ROBits(this.i2c_device, adress, 4, this._REG_DIE_UID, 0, 2, false)

                if (this._manufacturer_id.val != this.TEXAS_INSTRUMENT_ID) {
                    this.emit("error", new Error("Manufacturer ID is not same as intended! (" + this._manufacturer_id.val + " = " + this.TEXAS_INSTRUMENT_ID + ")"))
                }
                if (this._device_id.val != this.INA260_ID) {
                    this.emit("error", new Error("Device ID is not same as intended! (" + this._device_id.val + " = " + this.INA260_ID + ")"))
                }

                this.mode.val = this.CONTINUOUS
                this.initialized = true
            }
        }
    }

    startPoll(interval: number = 10): boolean {
        this.interval = setInterval(async () => {
            if (this.initialized) {
                this.emit("data", [this.power, this.voltage, this.current])
            }
        }, interval)
        return true
    }

    get current(): number {
        try {
            if (this.initialized) {
                if (this.mode?.val == this.TRIGGERED) {
                    while (!this._conversion_ready_flag?.val) {}
                }
                return this._raw_current!.val * 1.25
            } else {
                return -1
            }
        } catch (e) {
            this.emit("error", new Error("Error reading current, timeout"))
            return -1
        }
    }

    get voltage(): number {
        try {
            if (this.initialized) {
                if (this.mode?.val == this.TRIGGERED) {
                    while (!this._conversion_ready_flag?.val) {}
                }
                return this._raw_voltage!.val * 0.00125
            } else {
                return -1
            }
        } catch (e) {
            this.emit("error", new Error("Error reading voltage, timeout"))
            return -1
        }
    }

    get power(): number {
        if (this.initialized) {
            if (this.initialized) {
                if (this.mode?.val == this.TRIGGERED) {
                    while (!this._conversion_ready_flag?.val) {}
                }
                return this._raw_power!.val * 10
            } else {
                return -1
            }
        } else {
            this.emit("error", new Error("Error reading power. timeout"))
            return -1
        }
    }
}