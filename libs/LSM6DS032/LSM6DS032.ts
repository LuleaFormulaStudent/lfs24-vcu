import {I2CBus} from "i2c-bus"
import {sleep} from "../../src/helper_functions.js";
import os from "os";
import EventEmitter from "node:events";
import UnaryStruct from "./unary_struct.js";
import RWBit from "./rwbit.js";
import RWBits from "./rwbits.js";
import Struct from "./struct.js";

export function i2c_write_read(i2c: I2CBus, adress: number, buffer: Buffer): Buffer {
    i2c.i2cWriteSync(adress, 1, buffer)
    const read_buf = Buffer.alloc(buffer.length - 1)
    i2c.i2cReadSync(adress, read_buf.length, read_buf)
    buffer.set(read_buf, 1)
    return buffer
}

export default class LSM6DS032 extends EventEmitter {
    private i2c_device: I2CBus

    interval: any

    readonly gyro_ranges = {
        "RANGE_125_DPS": 125,
        "RANGE_250_DPS": 0,
        "RANGE_500_DPS": 1,
        "RANGE_1000_DPS": 2,
        "RANGE_2000_DPS": 3,
    }

    readonly gyro_ranges_convert = {
        "RANGE_125_DPS": 4.375,
        "RANGE_250_DPS": 8.75,
        "RANGE_500_DPS": 17.50,
        "RANGE_1000_DPS": 35.0,
        "RANGE_2000_DPS": 2000,
    }

    readonly accel_range = {
        "RANGE_2G": 0,
        "RANGE_16G": 1,
        "RANGE_4G": 2,
        "RANGE_8G": 3,
    }

    readonly accel_range_convert = {
        "RANGE_2G": 0.061,
        "RANGE_16G": 0.488,
        "RANGE_4G": 0.122,
        "RANGE_8G": 0.244,
    }

    readonly rate_range = {
        "RATE_SHUTDOWN": 0,
        "RATE_12_5_HZ": 1,
        "RATE_26_HZ": 2,
        "RATE_52_HZ": 3,
        "RATE_104_HZ": 4,
        "RATE_208_HZ": 5,
        "RATE_416_HZ": 6,
        "RATE_833_HZ": 7,
        "RATE_1_66K_HZ": 8,
        "RATE_3_33K_HZ": 9,
        "RATE_6_66K_HZ": 10,
        "RATE_1_6_HZ": 11,
    }

    readonly accel_hpf = {
        "SLOPE": 0,
        "HPF_DIV100": 1,
        "HPF_DIV9": 2,
        "HPF_DIV400": 3
    }

    LSM6DS_DEFAULT_ADDRESS = 0x6A
    LSM6DS_CHIP_ID = 0x6C

    _LSM6DS_MLC_INT1 = 0x0D
    _LSM6DS_WHOAMI = 0xF
    _LSM6DS_CTRL1_XL = 0x10
    _LSM6DS_CTRL2_G = 0x11
    _LSM6DS_CTRL3_C = 0x12
    _LSM6DS_CTRL8_XL = 0x17
    _LSM6DS_CTRL9_XL = 0x18
    _LSM6DS_CTRL10_C = 0x19
    _LSM6DS_ALL_INT_SRC = 0x1A
    _LSM6DS_OUT_TEMP_L = 0x20
    _LSM6DS_OUTX_L_G = 0x22
    _LSM6DS_OUTX_L_A = 0x28
    _LSM6DS_MLC_STATUS = 0x38
    _LSM6DS_STEP_COUNTER = 0x4B
    _LSM6DS_TAP_CFG0 = 0x56
    _LSM6DS_TAP_CFG = 0x58
    _LSM6DS_MLC0_SRC = 0x70
    _MILLI_G_TO_ACCEL = 0.00980665
    _TEMPERATURE_SENSITIVITY = 256.0
    _TEMPERATURE_OFFSET = 25.0

    _LSM6DS_EMB_FUNC_EN_A = 0x04
    _LSM6DS_EMB_FUNC_EN_B = 0x05
    _LSM6DS_FUNC_CFG_ACCESS = 0x01
    _LSM6DS_FUNC_CFG_BANK_USER = 0
    _LSM6DS_FUNC_CFG_BANK_HUB = 1
    _LSM6DS_FUNC_CFG_BANK_EMBED = 2

    current_accel_range = ""
    current_gyro_range = ""

    // ROUnaryStructs:
    _chip_id: UnaryStruct

    // Structs
    _raw_accel_data: Struct
    _raw_gyro_data: Struct
    _raw_temp_data: Struct
    _emb_func_en_a: Struct
    _emb_func_en_b: Struct
    _mlc0_src: Struct
    //RWBits:
    _accel_range: RWBits
    _accel_data_rate: RWBits

    _gyro_data_rate: RWBits
    _gyro_range: RWBits
    _gyro_range_125dps: RWBit

    _sw_reset: RWBit
    _bdu: RWBit

    _high_pass_filter: RWBits
    _i3c_disable: RWBit
    _pedometer_reset: RWBit
    _func_enable: RWBit
    _mem_bank: RWBit
    _mlc_status: RWBit
    _block_data_enable: RWBit
    _route_int1: RWBit
    _tap_latch: RWBit
    _tap_clear: RWBit
    _ped_enable: RWBit
    pedometer_steps: UnaryStruct
    CHIP_ID: number

    _cached_accel_range = null
    _cached_gyro_range = null

    initialized = false

    constructor(private adress: number = 0x6A, private bus_num: number = 1) {
        super()
        if (os.arch().startsWith("arm")) {
            import("i2c-bus").then(async (i2c) => {
                this.i2c_device = i2c.openSync(this.bus_num)
                await sleep(10)
                const result = this.i2c_device.scanSync(adress)
                if (!result.includes(adress)) {
                    this.emit("error", new Error("LSM6DS032 device not found at adress, " + adress))
                    console.log("error")
                    this.i2c_device = null
                } else {
                    this._chip_id = new UnaryStruct(this.i2c_device, adress, this._LSM6DS_WHOAMI, "<b")
                    // Structs
                    this._raw_accel_data = new Struct(this.i2c_device, adress, this._LSM6DS_OUTX_L_A, "<hhh")
                    this._raw_gyro_data = new Struct(this.i2c_device, adress, this._LSM6DS_OUTX_L_G, "<hhh")
                    this._raw_temp_data = new Struct(this.i2c_device, adress, this._LSM6DS_OUT_TEMP_L, "<h")
                    this._emb_func_en_a = new Struct(this.i2c_device, adress, this._LSM6DS_EMB_FUNC_EN_A, "<b")
                    this._emb_func_en_b = new Struct(this.i2c_device, adress, this._LSM6DS_EMB_FUNC_EN_B, "<b")
                    this._mlc0_src = new Struct(this.i2c_device, adress, this._LSM6DS_MLC0_SRC, "<bbbbbbbb")
                    //RWBits:
                    this._accel_range = new RWBits(this.i2c_device, adress, 2, this._LSM6DS_CTRL1_XL, 2)
                    this._accel_data_rate = new RWBits(this.i2c_device, adress, 4, this._LSM6DS_CTRL1_XL, 4)

                    this._gyro_data_rate = new RWBits(this.i2c_device, adress, 4, this._LSM6DS_CTRL2_G, 4)
                    this._gyro_range = new RWBits(this.i2c_device, adress, 2, this._LSM6DS_CTRL2_G, 2)
                    this._gyro_range_125dps = new RWBit(this.i2c_device, adress, this._LSM6DS_CTRL2_G, 1)

                    this._sw_reset = new RWBit(this.i2c_device, adress, this._LSM6DS_CTRL3_C, 0)
                    this._bdu = new RWBit(this.i2c_device, adress, this._LSM6DS_CTRL3_C, 6)

                    this._high_pass_filter = new RWBits(this.i2c_device, adress, 2, this._LSM6DS_CTRL8_XL, 5)
                    this._i3c_disable = new RWBit(this.i2c_device, adress, this._LSM6DS_CTRL9_XL, 1)
                    this._pedometer_reset = new RWBit(this.i2c_device, adress, this._LSM6DS_CTRL10_C, 1)
                    this._func_enable = new RWBit(this.i2c_device, adress, this._LSM6DS_CTRL10_C, 2)
                    this._mem_bank = new RWBit(this.i2c_device, adress, this._LSM6DS_FUNC_CFG_ACCESS, 7)
                    this._mlc_status = new RWBit(this.i2c_device, adress, this._LSM6DS_MLC_STATUS, 0)
                    this._i3c_disable = new RWBit(this.i2c_device, adress, this._LSM6DS_CTRL9_XL, 0)
                    this._block_data_enable = new RWBit(this.i2c_device, adress, this._LSM6DS_CTRL3_C, 4)
                    this._route_int1 = new RWBit(this.i2c_device, adress, this._LSM6DS_MLC_INT1, 0)
                    this._tap_latch = new RWBit(this.i2c_device, adress, this._LSM6DS_TAP_CFG0, 0)
                    this._tap_clear = new RWBit(this.i2c_device, adress, this._LSM6DS_TAP_CFG0, 6)
                    this._ped_enable = new RWBit(this.i2c_device, adress, this._LSM6DS_TAP_CFG, 6)
                    this.pedometer_steps = new UnaryStruct(this.i2c_device, adress, this._LSM6DS_STEP_COUNTER, "<h")

                    this.CHIP_ID = this._chip_id.val
                    if (this.CHIP_ID !== this.LSM6DS_CHIP_ID) {
                        this.emit("Wrong chip ID!")
                    }
                    this._sw_reset.val = true
                    await sleep(10)
                    this._bdu.val = true

                    this.accelerometer_data_rate = "RATE_104_HZ"
                    this.gyro_data_rate = "RATE_104_HZ"
                    await sleep(100)
                    this.accelerometer_range = "RANGE_4G"
                    await sleep(200)
                    this.gyro_range = "RANGE_250_DPS"
                    await sleep(200)
                    this.initialized = true
                }
            });
        }
    }

    accel_range_cache = ""
    gyro_range_cache = ""

    startPoll(interval: number = 10) {
        this.interval = setInterval(async () => {
            if (this.initialized) {
                this.emit("data", [this.temperature, ...this.acceleration, ...this.gyro])
            }
        }, interval)
    }

    get acceleration() {
        const raw_accel_data = this._raw_accel_data.val
        const x = raw_accel_data[0] * this.accel_range_convert[this.accel_range_cache] * this._MILLI_G_TO_ACCEL
        const y = raw_accel_data[1] * this.accel_range_convert[this.accel_range_cache] * this._MILLI_G_TO_ACCEL
        const z = raw_accel_data[2] * this.accel_range_convert[this.accel_range_cache] * this._MILLI_G_TO_ACCEL
        return [x, y, z]
    }

    get gyro() {
        const raw_gyro_data = this._raw_gyro_data.val
        const x = raw_gyro_data[0] * this.gyro_ranges_convert[this.gyro_range_cache] * Math.PI / 180.0 / 1000
        const y = raw_gyro_data[1] * this.gyro_ranges_convert[this.gyro_range_cache] * Math.PI / 180.0 / 1000
        const z = raw_gyro_data[2] * this.gyro_ranges_convert[this.gyro_range_cache] * Math.PI / 180.0 / 1000
        return [x, y, z]
    }

    get accelerometer_range(): number {
        return this._accel_range.val
    }

    set accelerometer_range(value: string) {
        if (!Object.keys(this.accel_range).includes(value)) {
            throw Error("Range most be a accel range")
        }
        this._accel_range.val = this.accel_range[value]
        this.accel_range_cache = value
    }

    get gyro_range(): number {
        return this._gyro_range.val
    }

    set gyro_range(value: string) {
        if (!Object.keys(this.gyro_ranges).includes(value)) {
            throw Error("Range most be a gyro range")
        }
        if (value == "RANGE_125_DPS") {
            this._gyro_range_125dps.val = true
        } else {
            this._gyro_range_125dps.val = false
            this._gyro_range.val = this.gyro_ranges[value]
        }
        this.gyro_range_cache = value
    }

    get accelerometer_data_rate(): number {
        return this._accel_data_rate.val
    }

    set accelerometer_data_rate(value: string) {
        if (!Object.keys(this.rate_range).includes(value)) {
            throw Error("Range most be a rate range")
        }
        this._accel_data_rate.val = this.rate_range[value]
    }

    get gyro_data_rate(): number {
        return this._gyro_data_rate.val
    }

    set gyro_data_rate(value: string) {
        if (!Object.keys(this.rate_range).includes(value)) {
            throw Error("Range most be a rate range")
        }
        this._gyro_data_rate.val = this.rate_range[value]
    }

    get temperature() {
        return this._raw_temp_data.val[0] / this._TEMPERATURE_SENSITIVITY + this._TEMPERATURE_OFFSET
    }

}