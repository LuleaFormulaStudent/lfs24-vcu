import DS3502 from "../../libs/DS3502/DS3502.js";
import Main from "../../main.js";
import {MavState} from "mavlink-mappings/dist/lib/minimal.js";
import {map_range} from "../helper_functions.js";

export default class BrakeController {

    device: DS3502 | null = null

    constructor(private main: Main) {
        if (this.main.in_production) {
            this.device = new DS3502(0x29)
            this.device.on("error", (err) => this.main.logs_controller.error("Error with DS3502:", err))
        }
    }

    async init() {
        if (this.device) {
            await this.device.setDefault(0);
        }

        this.main.data_controller.addParamListener("brake_input", ({value}) => {
            this.main.data_controller.params.brake_output = map_range(Math.max(value, this.main.data_controller.params.brake_dz), this.main.data_controller.params.brake_dz, 1, 0, this.main.data_controller.params.brake_max_val)
        })

        this.main.data_controller.addParamListener("brake_output", ({value}) => {
            this.main.digital_outputs_controller.setBrakeLightOutput(value > this.main.data_controller.params.brake_light_act && this.main.data_controller.params.system_state == MavState.ACTIVE)
        })
        await this.main.logs_controller.debug("Brake controller initialized!")
    }
}