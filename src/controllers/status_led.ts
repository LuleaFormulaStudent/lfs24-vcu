import {Gpio} from "onoff"
import Main from "../../main";

export default class StatusLed {

    red_led: Gpio | null
    green_led: Gpio | null
    blue_led: Gpio | null

    constructor(private main: Main) {
        if (this.main.in_production) {
            this.red_led = new Gpio(518, 'out');
            this.green_led = new Gpio(531, 'out');
            this.blue_led = new Gpio(538, 'out');
        } else {
            this.red_led = null
            this.green_led = null
            this.blue_led = null
        }
    }

    setRedLED(state: boolean) {
        try {
            this.main.data_controller.params.red_led_output = state
            if (this.red_led) {
                this.red_led.writeSync(state ? 1 : 0)
            }
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
        } catch (e) {
            this.main.logs_controller.error("Error when changing state of blue led: ", e)
        }
    }

}