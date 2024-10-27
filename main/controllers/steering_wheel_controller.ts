import Main from "../main.js";
import {MavState} from "mavlink-mappings/dist/lib/minimal.js";
import {DrivingMode} from "mavlink-lib/typescript/lfs.js";
import {common} from "node-mavlink";

export default class SteeringWheelController {
    driving_mode_forward_timeout: any
    driving_mode_reverse_timeout: any
    activate_ts_timeout: any

    button_1_state: boolean = false
    button_2_state: boolean = false
    button_3_state: boolean = false
    button_4_state: boolean = false

    constructor(private main: Main) {
    }

    async init() {
        await this.main.logs_controller.debug("Steering wheel controller initialized!")
    }

    async handleButtonChange(data: common.ButtonChange) {
        if ((data.state & 1) != this.button_1_state) {
            await this.onButtonPress(1, data.state & 1 ? "pressed" : "released")
        }
        if ((data.state & 2) != this.button_2_state) {
            await this.onButtonPress(2, data.state & 2 ? "pressed" : "released")
        }
        if ((data.state & 3) != this.button_3_state) {
            await this.onButtonPress(3, data.state & 3 ? "pressed" : "released")
        }
        if ((data.state & 4) != this.button_4_state) {
            await this.onButtonPress(4, data.state & 4 ? "pressed" : "released")
        }
    }

    async onButtonPress(button: number, event: "released" | "pressed") {
        if (event == "pressed" && button == 3) {
            this.driving_mode_forward_timeout = setTimeout(() => {
                if (this.main.data_controller.params.driving_mode == DrivingMode.NEUTRAL) {
                    this.main.setDrivingMode(DrivingMode.FORWARD)
                } else {
                    this.main.setDrivingMode(DrivingMode.NEUTRAL)
                }
            }, 1000)
        } else if (event == "released" && button == 3) {
            clearTimeout(this.driving_mode_forward_timeout)
        }
        if (event == "pressed" && button == 2) {
            this.driving_mode_reverse_timeout = setTimeout(() => {
                if (this.main.data_controller.params.driving_mode == DrivingMode.NEUTRAL) {
                    this.main.setDrivingMode(DrivingMode.REVERSE)
                } else {
                    this.main.setDrivingMode(DrivingMode.NEUTRAL)
                }
            }, 1000)
        } else if (event == "released" && button == 2) {
            clearTimeout(this.driving_mode_reverse_timeout)
        }
        if (event == "pressed" && button == 4) {
            this.activate_ts_timeout = setTimeout(() => {
                if (this.main.data_controller.params.system_state == MavState.ACTIVE) {
                    this.main.traction_system_controller.deactivateTS()
                } else {
                    this.main.traction_system_controller.activateTS()
                }
            }, 2000)
        } else if (event == "released" && button == 4) {
            clearTimeout(this.activate_ts_timeout)
        }
    }
}