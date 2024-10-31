import Main from "../main.js";
import {MavState} from "mavlink-mappings/dist/lib/minimal.js";
import {DrivingMode} from "mavlink-lib/typescript/lfs.js";
import {common} from "node-mavlink";

enum BUTTONS {
    BUTTON_1 = 1,
    BUTTON_2 = 2,
    BUTTON_3 = 4,
    BUTTON_4 = 8
}

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
        if (((data.state & BUTTONS.BUTTON_1) != 0) != this.button_1_state) {
            await this.onButtonPress(BUTTONS.BUTTON_1, (data.state & BUTTONS.BUTTON_1) != 0 ? "pressed" : "released")
            this.button_1_state = !this.button_1_state
        }
        if (((data.state & BUTTONS.BUTTON_2) != 0) != this.button_2_state) {
            await this.onButtonPress(BUTTONS.BUTTON_2, (data.state & BUTTONS.BUTTON_2) != 0 ? "pressed" : "released")
            this.button_2_state = !this.button_2_state
        }
        if (((data.state & BUTTONS.BUTTON_3) != 0) != this.button_3_state) {
            await this.onButtonPress(BUTTONS.BUTTON_3, (data.state & BUTTONS.BUTTON_3) != 0 ? "pressed" : "released")
            this.button_3_state = !this.button_3_state
        }
        if (((data.state & BUTTONS.BUTTON_4) != 0) != this.button_4_state) {
            await this.onButtonPress(BUTTONS.BUTTON_4, (data.state & BUTTONS.BUTTON_4) != 0 ? "pressed" : "released")
            this.button_4_state = !this.button_4_state
        }
    }

    async onButtonPress(button: BUTTONS, event: "released" | "pressed") {
        if (event == "pressed" && button == BUTTONS.BUTTON_3) {
            this.driving_mode_forward_timeout = setTimeout(() => {
                if (this.main.data_controller.params.driving_mode == DrivingMode.NEUTRAL) {
                    this.main.traction_system_controller.setDrivingDirection(DrivingMode.FORWARD)
                } else {
                    this.main.traction_system_controller.setDrivingDirection(DrivingMode.NEUTRAL)
                }
            }, 1000)
        } else if (event == "released" && button == BUTTONS.BUTTON_3) {
            clearTimeout(this.driving_mode_forward_timeout)
        }
        if (event == "pressed" && button == BUTTONS.BUTTON_2) {
            this.driving_mode_reverse_timeout = setTimeout(() => {
                if (this.main.data_controller.params.driving_mode == DrivingMode.NEUTRAL) {
                    this.main.traction_system_controller.setDrivingDirection(DrivingMode.REVERSE)
                } else {
                    this.main.traction_system_controller.setDrivingDirection(DrivingMode.NEUTRAL)
                }
            }, 1000)
        } else if (event == "released" && button == BUTTONS.BUTTON_2) {
            clearTimeout(this.driving_mode_reverse_timeout)
        }
        if (event == "pressed" && button == BUTTONS.BUTTON_4) {
            this.activate_ts_timeout = setTimeout(() => {
                if (this.main.data_controller.params.system_state == MavState.ACTIVE) {
                    this.main.traction_system_controller.deactivateTS()
                } else {
                    this.main.traction_system_controller.activateTS()
                }
            }, 2000)
        } else if (event == "released" && button == BUTTONS.BUTTON_4) {
            clearTimeout(this.activate_ts_timeout)
        }
    }
}