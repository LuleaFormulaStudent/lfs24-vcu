import {I2CBus} from "i2c-bus";
import {range} from "../helper_functions.js";

export default class RWBits {

    buffer: Buffer
    bit_mask: number
    sign_bit: number

    constructor(private i2c: I2CBus, private i2c_adress: number, num_bits: number, private register_address: number,
                private lowest_bit: number, register_width: number = 1, private lsb_first: boolean = true, signed: boolean = false) {
        this.bit_mask = ((1 << num_bits) - 1) << lowest_bit
        if (this.bit_mask >= 1 << (register_width * 8)) {
            throw Error("Cannot have more bits than register size")
        }

        this.buffer = Buffer.alloc(1 + register_width)
        this.buffer[0] = register_address
        this.sign_bit = signed? (1 << (num_bits - 1)) : 0
    }

    get val(): number {
        const read_buffer = Buffer.alloc(this.buffer.length - 1)
        this.i2c.readI2cBlockSync(this.i2c_adress, this.register_address, read_buffer.length, read_buffer)
        this.buffer.set(read_buffer, 1)
        let reg = 0
        if (this.lsb_first) {
            for (let i = this.buffer.length - 1; i > 0; i--) {
                console.log()
                reg = (reg << 8) | this.buffer[i]
            }
        } else {
            for (let i = 1; i < this.buffer.length; i++) {
                reg = (reg << 8) | this.buffer[i]
            }
        }
        reg = (reg & this.bit_mask) >> this.lowest_bit
        if (reg & this.sign_bit) {
            reg -= 2 * this.sign_bit
        }
        return reg
    }

    set val(value: number) {
        value <<= this.lowest_bit
        const read_buffer = Buffer.alloc(this.buffer.length - 1)
        this.i2c.readI2cBlockSync(this.i2c_adress, this.register_address, read_buffer.length, read_buffer)
        this.buffer.set(read_buffer, 1)
        let reg = 0
        let order = range(this.buffer.length, 0, -1)
        if (!this.lsb_first) {
            order = range(0, this.buffer.length, 1)
        }
        for (const i of order) {
            reg = (reg << 8) | this.buffer[i]
        }
        reg &= ~this.bit_mask
        reg |= value
        order.reverse()
        for (const i of order) {
            this.buffer[i] = reg & 0xFF
            reg >>= 8
        }
        this.i2c.i2cWriteSync(this.i2c_adress, this.buffer.length, this.buffer)
    }

}