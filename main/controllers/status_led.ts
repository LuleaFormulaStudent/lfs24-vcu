import {Gpio} from "onoff"
import Main from "../main.js";

export default class StatusLed {

    private readonly red_led: Gpio | null = null
    private readonly green_led: Gpio | null = null
    private readonly blue_led: Gpio | null = null

    constructor(private main: Main) {
        if (this.main.in_production) {
            this.red_led = new Gpio(518, 'out');    // BCM: 6
            this.green_led = new Gpio(533, 'out');  // BCM: 21
            this.blue_led = new Gpio(538, 'out');  // BCM: 26
        }
    }

    setRedLED(state: boolean) {
        try {
            this.main.data_controller.params.red_led_output = state
            if (this.red_led) {
                this.red_led.writeSync(state ? 1 : 0)
            }
            this.main.digital_outputs_controller.sendDOMessage()
        } catch (e) {
            this.main.logs_controller.error("Error when changing state of red led: ", e)
        }
    }

    setGreenLED(state: boolean) {
        try {
            this.main.data_controller.params.green_led_output = state
            if (this.green_led) {
                this.green_led.writeSync(state ? 1 : 0)
            }
            this.main.digital_outputs_controller.sendDOMessage()
        } catch (e) {
            this.main.logs_controller.error("Error when changing state of green led: ", e)
        }
    }

    setBlueLED(state: boolean) {
        try {
            this.main.data_controller.params.blue_led_output = state
            if (this.blue_led) {
                this.blue_led.writeSync(state ? 1 : 0)
            }
            this.main.digital_outputs_controller.sendDOMessage()
        } catch (e) {
            this.main.logs_controller.error("Error when changing state of blue led: ", e)
        }
    }

}