import Main from "../main.js";
import {MavState} from "mavlink-mappings/dist/lib/minimal.js";
import {DrivingMode} from "mavlink-lib/typescript/lfs.js";

export default class SteeringWheelController {
    driving_mode_forward_timeout: any
    driving_mode_reverse_timeout: any
    activate_ts_timeout: any

    constructor(private main: Main) {

    }

    async init() {

        await this.main.logs_controller.debug("Steering wheel controller initialized!")
    }
}