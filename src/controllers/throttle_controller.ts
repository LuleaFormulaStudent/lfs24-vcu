import DS3502 from "../../libs/DS3502/DS3502.js";
import Main from "../../main.js";
import {MavState} from "mavlink-mappings/dist/lib/minimal.js";
import {map_range} from "../helper_functions.js";

export default class ThrottleController {

    private readonly device: DS3502 | null = null

    constructor(private main: Main) {
        if (this.main.in_production) {
            this.device = new DS3502(0x28)
            this.device.on("error", (err) => this.main.logs_controller.error("Error with DS3502:", err))
        }
    }

    async init() {
        this.main.data_controller.addParamListener("throttle_input", ({value}) => {
            this.main.data_controller.params.throttle_output = map_range(Math.max(value, this.main.data_controller.params.throttle_dz), this.main.data_controller.params.throttle_dz, 1, 0, this.main.data_controller.params.throttle_max_val)
        })

        this.main.data_controller.addParamListener("throttle_output", ({value}) => {
            if (value > this.main.data_controller.params.foot_switch_act && this.main.data_controller.params.system_state == MavState.ACTIVE) {
                this.main.digital_outputs_controller.setFootSwitch(true)
            } else {
                this.main.digital_outputs_controller.setFootSwitch(false)
            }

            if (this.device && this.main.data_controller.params.system_state == MavState.ACTIVE) {
                this.device.write(value)
            }
        })

        await this.main.logs_controller.debug("Throttle controller initialized!")
    }
}