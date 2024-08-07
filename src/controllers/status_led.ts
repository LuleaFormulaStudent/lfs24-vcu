import {Gpio} from "onoff"
import Main from "../../main";

export default class StatusLed {

    red_led: Gpio
    green_led: Gpio
    blue_led: Gpio

    constructor(private main: Main) {
        if (this.main.in_production) {
            this.red_led = new Gpio(518, 'out');
            //this.green_led = new Gpio(531, 'out');
            this.blue_led = new Gpio(538, 'out');
        }

        this.main.logs_controller.debug("Status LED constructors initialized!")
    }

    setRedLED(state: boolean) {
        try {
            this.main.data_controller.params.red_led_output = state
            if (this.main.in_production) {
                this.red_led.writeSync(state ? 1 : 0)
            }
        } catch (e) {
            this.main.logs_controller.error("Error when changing state of red led: ", e)
        }
    }

    setGreenLED(state: boolean) {
        try {
            this.main.data_controller.params.green_led_output = state
            if (this.main.in_production) {
                this.green_led.writeSync(state ? 1 : 0)
            }
        } catch (e) {
            this.main.logs_controller.error("Error when changing state of green led: ", e)
        }
    }

    setBlueLED(state: boolean) {
        try {
            this.main.data_controller.params.blue_led_output = state
            if (this.main.in_production) {
                this.blue_led.writeSync(state ? 1 : 0)
            }
        } catch (e) {
            this.main.logs_controller.error("Error when changing state of blue led: ", e)
        }
    }

}