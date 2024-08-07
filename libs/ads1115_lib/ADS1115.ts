import {I2CBus} from "i2c-bus"
import {sleep} from "../../src/helper_functions.js";
import os from "os"

type ADS1115_CONFIG_DR = 8 | 16 | 32 | 64 | 128 | 250 | 475 | 860
type ADS1x15_CONFIG_GAIN = 1 | 2 | 4 | 8 | 16

export default class ADS1115 {
    ADS1x15_POINTER_CONVERSION = 0x00
    ADS1x15_POINTER_CONFIG = 0x01
    ADS1x15_POINTER_LOW_THRESHOLD = 0x02
    ADS1x15_POINTER_HIGH_THRESHOLD = 0x03
    ADS1x15_CONFIG_OS_SINGLE = 0x8000
    ADS1x15_CONFIG_MUX_OFFSET = 12
    // Mapping of gain values to config register values.
    ADS1x15_CONFIG_GAIN = {
        1: 0x0200,
        2: 0x0400,
        4: 0x0600,
        8: 0x0800,
        16: 0x0A00
    }
    ADS1x15_CONFIG_MODE_CONTINUOUS = 0x0000
    ADS1x15_CONFIG_MODE_SINGLE = 0x0100
    // Mapping of data/sample rate to config register values for ADS1115 (slower).
    ADS1115_CONFIG_DR = {
        8: 0x0000,
        16: 0x0020,
        32: 0x0040,
        64: 0x0060,
        128: 0x0080,
        250: 0x00A0,
        475: 0x00C0,
        860: 0x00E0
    }
    ADS1x15_CONFIG_COMP_WINDOW = 0x0010
    ADS1x15_CONFIG_COMP_ACTIVE_HIGH = 0x0008
    ADS1x15_CONFIG_COMP_LATCHING = 0x0004
    ADS1x15_CONFIG_COMP_QUE = {
        1: 0x0000,
        2: 0x0001,
        4: 0x0002
    }
    ADS1x15_CONFIG_COMP_QUE_DISABLE = 0x0003

    private i2c_device: I2CBus

    constructor(private adress: number = 0x48, private bus_num: number = 1) {
        if (os.arch().startsWith("arm")) {
            import("i2c-bus").then((i2c) => {
                this.i2c_device = i2c.openSync(this.bus_num)
            })
        }
    }

    private async read(mux: number, gain: ADS1x15_CONFIG_GAIN, data_rate: ADS1115_CONFIG_DR, mode: number) {
        /*
        Perform an ADC read with the provided mux, gain, data_rate, and mode
        values.  Returns the signed integer result of the read.
        */
        let config = this.ADS1x15_CONFIG_OS_SINGLE  // Go out of power-down mode for conversion.
        // Specify mux value.
        config |= (mux & 0x07) << this.ADS1x15_CONFIG_MUX_OFFSET
        // Validate the passed in gain and then set it in the config.

        config |= this.ADS1x15_CONFIG_GAIN[gain]
        // Set the mode (continuous or single shot).
        config |= mode
        config |= this.ADS1115_CONFIG_DR[data_rate]
        config |= this.ADS1x15_CONFIG_COMP_QUE_DISABLE  // Disble comparator mode.
        // Send the config value to start the ADC conversion.
        // Explicitly break the 16-bit value down to a big endian pair of bytes.
        this.i2c_device.writeI2cBlockSync(this.adress, this.ADS1x15_POINTER_CONFIG, 2, Buffer.from([(config >> 8) & 0xFF, config & 0xFF])) //
        // Wait for the ADC sample to finish based on the sample rate plus a
        // small offset to be sure (0.1 millisecond).

        await sleep(1000 / data_rate + 1)
        // Retrieve the result.

        const buffer = Buffer.alloc(2)
        const result = this.i2c_device.readI2cBlockSync(this.adress, this.ADS1x15_POINTER_CONVERSION, 2, buffer)
        return this.conversion_value(buffer[1], buffer[0])
    }

    async read_adc(channel: number, gain: ADS1x15_CONFIG_GAIN = 1, data_rate: ADS1115_CONFIG_DR = 128) {
        return this.read(channel + 0x04, gain, data_rate, this.ADS1x15_CONFIG_MODE_SINGLE)
    }

    async start_adc(channel: 0 | 1 | 2 | 3, gain: ADS1x15_CONFIG_GAIN = 1, data_rate: ADS1115_CONFIG_DR = 128) {
        /*Start continuous ADC conversions on the specified channel (0-3). Will
        return an initial conversion result, then call the get_last_result()
        function to read the most recent conversion result. Call stop_adc() to
        stop conversions.

        Start continuous reads and set the mux value to the channel plus the highest bit (bit 3) set.*/
        return await this.read(channel + 0x04, gain, data_rate, this.ADS1x15_CONFIG_MODE_CONTINUOUS)
    }

    stop_adc() {
        /*Stop all continuous ADC conversions (either normal or difference mode).
        Set the config register to its default value of 0x8583 to stop continuous conversions.*/

        const config = 0x8583
        this.i2c_device.writeWordSync(this.adress, this.ADS1x15_POINTER_CONFIG, config) //
    }

    async get_last_result() {
        /*Read the last conversion result when in continuous conversion mode.
        Will return a signed integer value.
        Retrieve the conversion register value, convert to a signed int, and
        return it.*/

        const result = this.i2c_device.readWordSync(this.adress, this.ADS1x15_POINTER_CONVERSION)
        return result //self._conversion_value(result[1], result[0])
    }

    private conversion_value(low: number, high: number) {
        // Convert to 16-bit signed value.
        let value = ((high & 0xFF) << 8) | (low & 0xFF)
        // Check for sign bit and turn into a negative value if set.
        if ((value & 0x8000) != 0) {
            value -= 1 << 16
        }

        return value
    }
}